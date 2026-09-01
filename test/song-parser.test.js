import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSongList } from '../server/song-parser.js';
import { isVipNickname, normalizeNickname, normalizeVipNicknames } from '../server/database.js';

test('parses artist sections, chorus tags and related notes', () => {
  const songs = parseSongList('A\n歌手：普通歌、合唱歌（合唱）、夏天（关联：冬天）');
  assert.deepEqual(songs, [
    { artist: '歌手', title: '普通歌', section: 'A', isChorus: false, note: '' },
    { artist: '歌手', title: '合唱歌', section: 'A', isChorus: true, note: '' },
    { artist: '歌手', title: '夏天', section: 'A', isChorus: false, note: '关联：冬天' },
  ]);
});

test('VIP nicknames are exact, case-insensitive and whitespace-insensitive', () => {
  assert.equal(isVipNickname('lclol'), true);
  assert.equal(isVipNickname(' LOL '), true);
  assert.equal(isVipNickname('lclol123'), false);
  assert.equal(normalizeNickname(' L C '), 'lc');
  assert.deepEqual(normalizeVipNicknames([' LCLol ', 'lol', '', ' LOL ']), ['lclol', 'lol']);
  assert.equal(isVipNickname('NewBird', ['newbird']), true);
  assert.equal(isVipNickname('lclol', ['newbird']), false);
});

test('parses loose songs from the other and newly-added sections', () => {
  const songs = parseSongList([
    '其他（网络热歌/暂无统一演唱者版本）',
    '夜光杯',
    '后面新添加（整理进前面）：光亮 周深',
    '一    A G A',
    '同簪 小时姑娘、H I T A',
  ].join('\n'));
  assert.deepEqual(songs, [
    { artist: '其他', title: '夜光杯', section: '#', isChorus: false, note: '' },
    { artist: '周深', title: '光亮', section: '#', isChorus: false, note: '' },
    { artist: 'A G A', title: '一', section: '#', isChorus: false, note: '' },
    { artist: '小时姑娘/HITA', title: '同簪', section: '#', isChorus: false, note: '' },
  ]);
});
