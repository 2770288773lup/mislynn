import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { parseSongList } from './song-parser.js';

const DEFAULT_SETTINGS = {
  requestsOpen: true,
  maxPerViewer: 2,
  notice: '欢迎小鸟们来点歌',
};

const REQUIRED_SONGS = [
  { artist: '炎明熹', title: '风旅' },
  { artist: '陈佳', title: '月下煮茶' },
  { artist: 'Aki阿杰', title: '挑兰灯' },
  { artist: '阿YueYue', title: '我恨明月不照我' },
];

const SONG_CORRECTIONS = [
  { title: '同簪', artist: '小时姑娘/HITA', legacyTitlePrefix: '同簪 %' },
  { title: '蓝桥玉杵', artist: '秋雪' },
];

export function normalizeNickname(nickname) {
  return nickname.trim().toLowerCase().replace(/\s+/g, '');
}

export function isVipNickname(nickname) {
  return ['lclol', 'lol'].includes(normalizeNickname(nickname));
}

export function createDatabase({ dataDir, songFile }) {
  fs.mkdirSync(dataDir, { recursive: true });
  const database = new DatabaseSync(path.join(dataDir, 'linzi-song-stage.db'));
  database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  database.exec(`
    CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artist TEXT NOT NULL,
      title TEXT NOT NULL,
      section TEXT NOT NULL DEFAULT '',
      is_chorus INTEGER NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id INTEGER,
      song_title TEXT NOT NULL,
      artist TEXT NOT NULL,
      nickname TEXT NOT NULL,
      normalized_nickname TEXT NOT NULL,
      is_vip INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'queued',
      sort_order REAL NOT NULL,
      requested_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT,
      FOREIGN KEY(song_id) REFERENCES songs(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_queue_status_order ON queue(status, sort_order);
    CREATE INDEX IF NOT EXISTS idx_queue_nickname_status ON queue(normalized_nickname, status);
  `);

  const count = database.prepare('SELECT COUNT(*) AS count FROM songs').get().count;
  if (count === 0) {
    const source = fs.readFileSync(songFile, 'utf8');
    const songs = parseSongList(source);
    const insert = database.prepare(`
      INSERT INTO songs (artist, title, section, is_chorus, note)
      VALUES (?, ?, ?, ?, ?)
    `);
    database.exec('BEGIN');
    try {
      for (const song of songs) {
        insert.run(song.artist, song.title, song.section, song.isChorus ? 1 : 0, song.note);
      }
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  // Keep explicit user-requested additions available when upgrading an existing database.
  const findSong = database.prepare('SELECT id FROM songs WHERE artist = ? AND title = ? LIMIT 1');
  const insertRequiredSong = database.prepare(`
    INSERT INTO songs (artist, title, section) VALUES (?, ?, '#')
  `);
  for (const song of REQUIRED_SONGS) {
    if (!findSong.get(song.artist, song.title)) insertRequiredSong.run(song.artist, song.title);
  }
  for (const correction of SONG_CORRECTIONS) {
    if (correction.legacyTitlePrefix) {
      database.prepare(`
        UPDATE songs SET title = ?, artist = ? WHERE title = ? OR title LIKE ?
      `).run(correction.title, correction.artist, correction.title, correction.legacyTitlePrefix);
    } else {
      database.prepare('UPDATE songs SET artist = ? WHERE title = ?').run(correction.artist, correction.title);
    }
  }

  const settingInsert = database.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    settingInsert.run(key, JSON.stringify(value));
  }

  return database;
}

export function readSettings(database) {
  const settings = { ...DEFAULT_SETTINGS };
  for (const row of database.prepare('SELECT key, value FROM settings').all()) {
    try {
      settings[row.key] = JSON.parse(row.value);
    } catch {
      settings[row.key] = row.value;
    }
  }
  return settings;
}

export function writeSetting(database, key, value) {
  database.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, JSON.stringify(value));
}

export function publicState(database) {
  const songs = database.prepare(`
    SELECT id, artist, title, section, is_chorus AS isChorus, note
    FROM songs WHERE is_active = 1 ORDER BY section, artist, id
  `).all().map((song) => ({ ...song, isChorus: Boolean(song.isChorus) }));

  const queue = database.prepare(`
    SELECT id, song_id AS songId, song_title AS songTitle, artist, nickname,
           is_vip AS isVip, status, requested_at AS requestedAt, started_at AS startedAt
    FROM queue WHERE status IN ('singing', 'queued')
    ORDER BY CASE status WHEN 'singing' THEN 0 ELSE 1 END, sort_order, id
  `).all().map((item) => ({ ...item, isVip: Boolean(item.isVip) }));

  return { songs, queue, settings: readSettings(database) };
}

export function adminState(database) {
  const base = publicState(database);
  const songs = database.prepare(`
    SELECT id, artist, title, section, is_chorus AS isChorus, note, is_active AS isActive
    FROM songs ORDER BY is_active DESC, section, artist, id
  `).all().map((song) => ({
    ...song,
    isChorus: Boolean(song.isChorus),
    isActive: Boolean(song.isActive),
  }));
  const history = database.prepare(`
    SELECT id, song_title AS songTitle, artist, nickname, is_vip AS isVip,
           status, requested_at AS requestedAt, finished_at AS finishedAt
    FROM queue WHERE status IN ('done', 'skipped')
    ORDER BY finished_at DESC, id DESC LIMIT 50
  `).all().map((item) => ({ ...item, isVip: Boolean(item.isVip) }));
  return { ...base, songs, history };
}
