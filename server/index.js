import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import crypto from 'node:crypto';
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { Server } from 'socket.io';
import { createAdminToken, safePasswordEqual, verifyAdminToken } from './auth.js';
import {
  adminState,
  createDatabase,
  isVipNickname,
  normalizeNickname,
  publicState,
  readSettings,
  writeSetting,
} from './database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 3000);
const dataDir = path.resolve(rootDir, process.env.DATA_DIR || 'data');
const adminPassword = process.env.ADMIN_PASSWORD || 'linzi-admin';
const authSecret = process.env.AUTH_SECRET || 'linzi-local-secret-change-in-production';
const database = createDatabase({ dataDir, songFile: path.join(rootDir, '歌单6.txt') });

const app = express();
const server = http.createServer(app);
const io = new Server(server, { serveClient: false });

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '100kb' }));

const requestLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: '点得太快啦，请稍后再试' },
});

function emitUpdate() {
  io.emit('state:update', { at: Date.now() });
}

function requireAdmin(request, response, next) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!verifyAdminToken(token, authSecret)) {
    return response.status(401).json({ message: '主播登录已失效，请重新登录' });
  }
  next();
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

app.get('/api/state', (_request, response) => {
  response.json(publicState(database));
});

app.post('/api/queue', requestLimiter, (request, response) => {
  const nickname = cleanText(request.body.nickname, 24);
  const songId = Number(request.body.songId);
  if (!nickname) return response.status(400).json({ message: '请先输入昵称' });
  if (!Number.isInteger(songId)) return response.status(400).json({ message: '请选择有效歌曲' });

  const settings = readSettings(database);
  if (!settings.requestsOpen) return response.status(409).json({ message: '现在暂停接收点歌' });

  const song = database.prepare(`
    SELECT id, artist, title FROM songs WHERE id = ? AND is_active = 1
  `).get(songId);
  if (!song) return response.status(404).json({ message: '这首歌暂时不可点' });

  const duplicate = database.prepare(`
    SELECT id FROM queue WHERE song_id = ? AND status IN ('queued', 'singing')
  `).get(songId);
  if (duplicate) return response.status(409).json({ message: '这首歌已经在队列里啦' });

  const normalizedNickname = normalizeNickname(nickname);
  const vip = isVipNickname(nickname);
  if (!vip) {
    const activeCount = database.prepare(`
      SELECT COUNT(*) AS count FROM queue
      WHERE normalized_nickname = ? AND status IN ('queued', 'singing')
    `).get(normalizedNickname).count;
    if (activeCount >= settings.maxPerViewer) {
      return response.status(409).json({ message: `每位小鸟最多同时点 ${settings.maxPerViewer} 首歌` });
    }
  }

  const maxOrder = database.prepare(`
    SELECT COALESCE(MAX(sort_order), 0) AS value FROM queue WHERE status = 'queued'
  `).get().value;
  const result = database.prepare(`
    INSERT INTO queue (
      song_id, song_title, artist, nickname, normalized_nickname,
      is_vip, status, sort_order, requested_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, ?)
  `).run(
    song.id,
    song.title,
    song.artist,
    nickname,
    normalizedNickname,
    vip ? 1 : 0,
    maxOrder + 1,
    new Date().toISOString(),
  );

  const position = database.prepare(`
    SELECT COUNT(*) AS count FROM queue
    WHERE status = 'queued' AND sort_order <= (SELECT sort_order FROM queue WHERE id = ?)
  `).get(result.lastInsertRowid).count;

  emitUpdate();
  response.status(201).json({ id: Number(result.lastInsertRowid), position, isVip: vip });
});

app.post('/api/admin/login', rateLimit({ windowMs: 60_000, limit: 10 }), (request, response) => {
  const password = typeof request.body.password === 'string' ? request.body.password : '';
  if (!safePasswordEqual(password, adminPassword)) {
    return response.status(401).json({ message: '密码不正确' });
  }
  response.json({ token: createAdminToken(authSecret) });
});

app.get('/api/admin/state', requireAdmin, (_request, response) => {
  response.json(adminState(database));
});

app.patch('/api/admin/settings', requireAdmin, (request, response) => {
  const allowed = ['requestsOpen', 'maxPerViewer', 'notice'];
  for (const key of allowed) {
    if (!(key in request.body)) continue;
    let value = request.body[key];
    if (key === 'requestsOpen') value = Boolean(value);
    if (key === 'maxPerViewer') value = Math.max(1, Math.min(20, Number(value) || 2));
    if (key === 'notice') value = cleanText(value, 80);
    writeSetting(database, key, value);
  }
  emitUpdate();
  response.json(readSettings(database));
});

app.post('/api/admin/queue/manual', requireAdmin, (request, response) => {
  const songId = Number(request.body.songId);
  const nickname = cleanText(request.body.nickname, 24) || '林子';
  const song = database.prepare('SELECT id, artist, title FROM songs WHERE id = ?').get(songId);
  if (!song) return response.status(404).json({ message: '歌曲不存在' });

  const maxOrder = database.prepare(`
    SELECT COALESCE(MAX(sort_order), 0) AS value FROM queue WHERE status = 'queued'
  `).get().value;
  database.prepare(`
    INSERT INTO queue (
      song_id, song_title, artist, nickname, normalized_nickname,
      is_vip, status, sort_order, requested_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, ?)
  `).run(
    song.id, song.title, song.artist, nickname, normalizeNickname(nickname),
    isVipNickname(nickname) ? 1 : 0, maxOrder + 1, new Date().toISOString(),
  );
  emitUpdate();
  response.status(201).json({ ok: true });
});

app.patch('/api/admin/queue/:id', requireAdmin, (request, response) => {
  const id = Number(request.params.id);
  const action = request.body.action;
  const item = database.prepare('SELECT * FROM queue WHERE id = ?').get(id);
  if (!item) return response.status(404).json({ message: '队列记录不存在' });
  const now = new Date().toISOString();

  if (action === 'start') {
    database.exec('BEGIN');
    try {
      database.prepare(`
        UPDATE queue SET status = 'queued', started_at = NULL
        WHERE status = 'singing' AND id != ?
      `).run(id);
      database.prepare(`
        UPDATE queue SET status = 'singing', started_at = ? WHERE id = ?
      `).run(now, id);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  } else if (action === 'done' || action === 'skip') {
    const status = action === 'done' ? 'done' : 'skipped';
    database.prepare('UPDATE queue SET status = ?, finished_at = ? WHERE id = ?').run(status, now, id);
  } else if (action === 'remove') {
    database.prepare('DELETE FROM queue WHERE id = ?').run(id);
  } else if (action === 'moveUp' || action === 'moveDown') {
    const operator = action === 'moveUp' ? '<' : '>';
    const direction = action === 'moveUp' ? 'DESC' : 'ASC';
    const neighbor = database.prepare(`
      SELECT id, sort_order FROM queue
      WHERE status = 'queued' AND sort_order ${operator} ?
      ORDER BY sort_order ${direction} LIMIT 1
    `).get(item.sort_order);
    if (neighbor) {
      database.exec('BEGIN');
      try {
        database.prepare('UPDATE queue SET sort_order = ? WHERE id = ?').run(neighbor.sort_order, id);
        database.prepare('UPDATE queue SET sort_order = ? WHERE id = ?').run(item.sort_order, neighbor.id);
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    }
  } else {
    return response.status(400).json({ message: '未知操作' });
  }

  emitUpdate();
  response.json({ ok: true });
});

app.post('/api/admin/songs', requireAdmin, (request, response) => {
  const title = cleanText(request.body.title, 80);
  const artist = cleanText(request.body.artist, 80);
  if (!title || !artist) return response.status(400).json({ message: '请填写歌名和歌手' });
  const result = database.prepare(`
    INSERT INTO songs (artist, title, section, is_chorus, note)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    artist,
    title,
    artist[0]?.toUpperCase() || '#',
    request.body.isChorus ? 1 : 0,
    cleanText(request.body.note, 120),
  );
  emitUpdate();
  response.status(201).json({ id: Number(result.lastInsertRowid) });
});

app.patch('/api/admin/songs/:id', requireAdmin, (request, response) => {
  const id = Number(request.params.id);
  const song = database.prepare('SELECT * FROM songs WHERE id = ?').get(id);
  if (!song) return response.status(404).json({ message: '歌曲不存在' });
  const title = cleanText(request.body.title ?? song.title, 80);
  const artist = cleanText(request.body.artist ?? song.artist, 80);
  const note = cleanText(request.body.note ?? song.note, 120);
  const isChorus = 'isChorus' in request.body ? Boolean(request.body.isChorus) : Boolean(song.is_chorus);
  const isActive = 'isActive' in request.body ? Boolean(request.body.isActive) : Boolean(song.is_active);
  if (!title || !artist) return response.status(400).json({ message: '歌名和歌手不能为空' });
  database.prepare(`
    UPDATE songs SET title = ?, artist = ?, note = ?, is_chorus = ?, is_active = ? WHERE id = ?
  `).run(title, artist, note, isChorus ? 1 : 0, isActive ? 1 : 0, id);
  emitUpdate();
  response.json({ ok: true });
});

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, service: 'linzi-song-stage' });
});

app.use('/assets/character', express.static(path.join(rootDir, 'pictures'), {
  immutable: true,
  maxAge: '7d',
}));

const distDir = path.join(rootDir, 'dist');
app.use(express.static(distDir, { maxAge: '1h' }));
app.get(/.*/, (_request, response) => {
  response.sendFile(path.join(distDir, 'index.html'));
});

app.use((error, _request, response, _next) => {
  const errorId = crypto.randomUUID().slice(0, 8);
  console.error(`[${errorId}]`, error);
  response.status(500).json({ message: `服务暂时出了点问题（${errorId}）` });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`林子的歌单服务已启动：http://localhost:${port}`);
  if (adminPassword === 'linzi-admin') {
    console.warn('当前使用默认主播密码 linzi-admin，公网部署前请设置 ADMIN_PASSWORD。');
  }
});

function shutdown() {
  io.close();
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
