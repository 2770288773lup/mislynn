const SECTION_RE = /^[A-Z]$/;

export function parseSongList(text) {
  const songs = [];
  let section = '';
  let looseMode = '';

  function addSong(artist, rawTitle, overrides = {}) {
    const originalTitle = rawTitle.trim();
    if (!originalTitle) return;

    const isChorus = /[（(]合唱[）)]/.test(originalTitle);
    const relatedMatch = originalTitle.match(/[（(]关联：(.+?)[）)]/);
    const title = originalTitle
      .replace(/[（(]合唱[）)]/g, '')
      .replace(/[（(]关联：.+?[）)]/g, '')
      .trim();

    songs.push({
      artist: artist.trim() || '其他',
      title,
      section: overrides.section ?? section,
      isChorus,
      note: relatedMatch ? `关联：${relatedMatch[1]}` : '',
    });
  }

  function addLooseEntry(line) {
    // The source file has one accidentally joined line containing two song/artist pairs.
    if (line === '芊芊 阿Yue Yue只为摆正你的背影 齐修远、应嘉俐') {
      addSong('阿YueYue', '芊芊', { section: '#' });
      addSong('齐修远、应嘉俐', '只为摆正你的背影', { section: '#' });
      return;
    }

    if (line === '同簪 小时姑娘、H I T A') {
      addSong('小时姑娘/HITA', '同簪', { section: '#' });
      return;
    }

    const wideGap = line.match(/^(.+?)\s{2,}(.+)$/);
    if (wideGap) {
      addSong(wideGap[2], wideGap[1], { section: '#' });
      return;
    }

    const splitAt = line.lastIndexOf(' ');
    if (splitAt > 0) {
      addSong(line.slice(splitAt + 1), line.slice(0, splitAt), { section: '#' });
    } else {
      addSong('其他', line, { section: '#' });
    }
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (SECTION_RE.test(line)) {
      section = line;
      looseMode = '';
      continue;
    }

    if (line.startsWith('其他（网络热歌')) {
      section = '#';
      looseMode = 'other';
      continue;
    }

    if (line.startsWith('后面新添加（整理进前面）')) {
      looseMode = 'added';
      const firstEntry = line.slice(line.indexOf('：') + 1).trim();
      if (firstEntry) addLooseEntry(firstEntry);
      continue;
    }

    if (looseMode === 'other') {
      addSong('其他', line, { section: '#' });
      continue;
    }

    if (looseMode === 'added') {
      addLooseEntry(line);
      continue;
    }

    const separator = line.indexOf('：');
    if (separator < 1) continue;

    const artist = line.slice(0, separator).trim();
    const entries = line.slice(separator + 1).split('、');

    for (const rawEntry of entries) addSong(artist, rawEntry);
  }

  return songs;
}
