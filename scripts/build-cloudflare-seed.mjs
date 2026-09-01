import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSongList } from '../server/song-parser.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, '歌单6.txt'), 'utf8');
const songs = parseSongList(source);
const required = [
  { artist: '炎明熹', title: '风旅' },
  { artist: '陈佳', title: '月下煮茶' },
  { artist: 'Aki阿杰', title: '挑兰灯' },
  { artist: '阿YueYue', title: '我恨明月不照我' },
];
for (const song of required) if (!songs.some((entry) => entry.artist === song.artist && entry.title === song.title)) songs.push({ ...song, section: '#', isChorus: false, note: '' });
for (const song of songs) {
  if (song.title.startsWith('同簪')) { song.title = '同簪'; song.artist = '小时姑娘/HITA'; }
  if (song.title === '蓝桥玉杵') song.artist = '秋雪';
}
const output = path.join(root, 'cloudflare', 'songs.generated.js');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `export default ${JSON.stringify(songs, null, 2)};\n`, 'utf8');
const characterDir = path.join(root, 'public', 'assets', 'character');
fs.mkdirSync(characterDir, { recursive: true });
for (const file of fs.readdirSync(path.join(root, 'pictures'))) fs.copyFileSync(path.join(root, 'pictures', file), path.join(characterDir, file));
console.log(`Generated ${songs.length} songs and copied character assets.`);
