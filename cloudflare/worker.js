import seedSongs from './songs.generated.js';

const DEFAULT_SETTINGS = {
  requestsOpen: true,
  maxPerViewer: 2,
  notice: '欢迎小鸟们来点歌',
  vipNicknames: ['lclol', 'lol'],
};
const TOKEN_TTL_SECONDS = 12 * 60 * 60;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function normalizeNickname(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

function normalizeVipNicknames(value) {
  const values = Array.isArray(value) ? value : [];
  return [...new Set(values.filter((item) => typeof item === 'string').map(normalizeNickname).filter(Boolean))].slice(0, 100);
}

function isVipNickname(value, vipNicknames = DEFAULT_SETTINGS.vipNicknames) {
  return normalizeVipNicknames(vipNicknames).includes(normalizeNickname(value));
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function base64url(bytes) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function hmac(payload, secret) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  return base64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
}

async function createAdminToken(secret) {
  const payload = base64url(new TextEncoder().encode(JSON.stringify({
    role: 'admin', exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  })));
  return `${payload}.${await hmac(payload, secret)}`;
}

async function verifyAdminToken(token, secret) {
  if (!token || !token.includes('.')) return false;
  const [payload, supplied] = token.split('.');
  const expected = await hmac(payload, secret);
  if (supplied.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  if (mismatch !== 0) return false;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromBase64url(payload)));
    return data.role === 'admin' && data.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function initialState() {
  return {
    songs: seedSongs.map((song, index) => ({ ...song, id: index + 1, isActive: true })),
    queue: [],
    history: [],
    settings: { ...DEFAULT_SETTINGS },
    nextSongId: seedSongs.length + 1,
    nextQueueId: 1,
  };
}

export class StageRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clients = new Set();
    this.rate = new Map();
  }

  async load() {
    let value = await this.state.storage.get('stage');
    if (!value) {
      value = initialState();
      await this.state.storage.put('stage', value);
    }
    value.settings = { ...DEFAULT_SETTINGS, ...(value.settings || {}) };
    value.settings.vipNicknames = normalizeVipNicknames(value.settings.vipNicknames);
    return value;
  }

  async save(value) {
    await this.state.storage.put('stage', value);
    const message = JSON.stringify({ type: 'state:update', at: Date.now() });
    for (const client of this.clients) {
      try { client.send(message); } catch { this.clients.delete(client); }
    }
  }

  allow(request, bucket, limit) {
    const key = `${bucket}:${request.headers.get('CF-Connecting-IP') || 'unknown'}`;
    const now = Date.now();
    const recent = (this.rate.get(key) || []).filter((time) => now - time < 60_000);
    if (recent.length >= limit) return false;
    recent.push(now);
    this.rate.set(key, recent);
    return true;
  }

  async requireAdmin(request) {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    return verifyAdminToken(token, this.env.AUTH_SECRET || 'change-me');
  }

  async fetch(request) {
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') return this.upgrade(request);
    const url = new URL(request.url);
    const state = await this.load();
    try {
      if (url.pathname === '/api/health' && request.method === 'GET') return json({ ok: true, service: 'linzi-song-stage' });
      if (url.pathname === '/api/state' && request.method === 'GET') return json(this.publicState(state));
      if (url.pathname === '/api/queue' && request.method === 'POST') return this.addQueue(request, state);
      if (url.pathname === '/api/admin/login' && request.method === 'POST') return this.login(request);
      if (url.pathname === '/api/admin/state' && request.method === 'GET') {
        if (!await this.requireAdmin(request)) return json({ message: '主播登录已失效，请重新登录' }, 401);
        return json(state);
      }
      if (url.pathname === '/api/admin/settings' && request.method === 'PATCH') return this.updateSettings(request, state);
      if (url.pathname === '/api/admin/queue/manual' && request.method === 'POST') return this.manualQueue(request, state);
      const queueMatch = url.pathname.match(/^\/api\/admin\/queue\/(\d+)$/);
      if (queueMatch && request.method === 'PATCH') return this.queueAction(request, state, Number(queueMatch[1]));
      if (url.pathname === '/api/admin/songs' && request.method === 'POST') return this.addSong(request, state);
      const songMatch = url.pathname.match(/^\/api\/admin\/songs\/(\d+)$/);
      if (songMatch && request.method === 'PATCH') return this.updateSong(request, state, Number(songMatch[1]));
      return json({ message: '未找到请求' }, 404);
    } catch (error) {
      console.error(error);
      return json({ message: '服务暂时出了点问题' }, 500);
    }
  }

  async body(request) {
    try { return await request.json(); } catch { return {}; }
  }

  publicState(state) {
    return {
      songs: state.songs.filter((song) => song.isActive),
      queue: state.queue.filter((item) => item.status === 'queued' || item.status === 'singing')
        .sort((a, b) => (a.status === 'singing' ? -1 : 1) - (b.status === 'singing' ? -1 : 1) || a.sortOrder - b.sortOrder || a.id - b.id),
      settings: state.settings,
    };
  }

  async addQueue(request, state) {
    if (!this.allow(request, 'queue', 20)) return json({ message: '点得太快啦，请稍后再试' }, 429);
    const data = await this.body(request);
    const nickname = cleanText(data.nickname, 24);
    const songId = Number(data.songId);
    if (!nickname) return json({ message: '请先输入昵称' }, 400);
    if (!Number.isInteger(songId)) return json({ message: '请选择有效歌曲' }, 400);
    if (!state.settings.requestsOpen) return json({ message: '现在暂时停止接收点歌' }, 409);
    const song = state.songs.find((item) => item.id === songId && item.isActive);
    if (!song) return json({ message: '这首歌暂时不可点' }, 404);
    if (state.queue.some((item) => item.songId === songId && (item.status === 'queued' || item.status === 'singing'))) {
      return json({ message: '这首歌已经在队列里啦' }, 409);
    }
    const vip = isVipNickname(nickname, state.settings.vipNicknames);
    const normalized = normalizeNickname(nickname);
    if (!vip && state.queue.filter((item) => item.normalizedNickname === normalized && (item.status === 'queued' || item.status === 'singing')).length >= state.settings.maxPerViewer) {
      return json({ message: `每位小鸟最多同时点 ${state.settings.maxPerViewer} 首歌` }, 409);
    }
    const sortOrder = Math.max(0, ...state.queue.filter((item) => item.status === 'queued').map((item) => item.sortOrder)) + 1;
    const item = { id: state.nextQueueId++, songId, songTitle: song.title, artist: song.artist, nickname, normalizedNickname: normalized, isVip: vip, status: 'queued', sortOrder, requestedAt: new Date().toISOString(), startedAt: null };
    state.queue.push(item);
    await this.save(state);
    return json({ id: item.id, position: state.queue.filter((entry) => entry.status === 'queued' && entry.sortOrder <= sortOrder).length, isVip: vip }, 201);
  }

  async login(request) {
    if (!this.allow(request, 'login', 10)) return json({ message: '登录尝试过于频繁' }, 429);
    const data = await this.body(request);
    if (cleanText(data.password, 200) !== (this.env.ADMIN_PASSWORD || '')) return json({ message: '密码不正确' }, 401);
    return json({ token: await createAdminToken(this.env.AUTH_SECRET || 'change-me') });
  }

  async updateSettings(request, state) {
    if (!await this.requireAdmin(request)) return json({ message: '主播登录已失效，请重新登录' }, 401);
    const data = await this.body(request);
    if ('requestsOpen' in data) state.settings.requestsOpen = Boolean(data.requestsOpen);
    if ('maxPerViewer' in data) state.settings.maxPerViewer = Math.max(1, Math.min(20, Number(data.maxPerViewer) || 2));
    if ('notice' in data) state.settings.notice = cleanText(data.notice, 80);
    if ('vipNicknames' in data) state.settings.vipNicknames = normalizeVipNicknames(data.vipNicknames);
    await this.save(state);
    return json(state.settings);
  }

  async manualQueue(request, state) {
    if (!await this.requireAdmin(request)) return json({ message: '主播登录已失效，请重新登录' }, 401);
    const data = await this.body(request);
    const song = state.songs.find((item) => item.id === Number(data.songId));
    if (!song) return json({ message: '歌曲不存在' }, 404);
    const sortOrder = Math.max(0, ...state.queue.filter((item) => item.status === 'queued').map((item) => item.sortOrder)) + 1;
    const nickname = cleanText(data.nickname, 24) || '林子';
    state.queue.push({ id: state.nextQueueId++, songId: song.id, songTitle: song.title, artist: song.artist, nickname, normalizedNickname: normalizeNickname(nickname), isVip: isVipNickname(nickname, state.settings.vipNicknames), status: 'queued', sortOrder, requestedAt: new Date().toISOString(), startedAt: null });
    await this.save(state);
    return json({ ok: true }, 201);
  }

  async queueAction(request, state, id) {
    if (!await this.requireAdmin(request)) return json({ message: '主播登录已失效，请重新登录' }, 401);
    const data = await this.body(request);
    const item = state.queue.find((entry) => entry.id === id);
    if (!item) return json({ message: '队列记录不存在' }, 404);
    const now = new Date().toISOString();
    if (data.action === 'start') {
      for (const entry of state.queue) if (entry.status === 'singing' && entry.id !== id) entry.status = 'queued';
      item.status = 'singing'; item.startedAt = now;
    } else if (data.action === 'done' || data.action === 'skip') {
      item.status = data.action === 'done' ? 'done' : 'skipped'; item.finishedAt = now;
      state.history.unshift({ ...item }); state.history = state.history.slice(0, 50);
    } else if (data.action === 'remove') {
      state.queue = state.queue.filter((entry) => entry.id !== id);
    } else if (data.action === 'moveUp' || data.action === 'moveDown') {
      const queued = state.queue.filter((entry) => entry.status === 'queued').sort((a, b) => a.sortOrder - b.sortOrder);
      const index = queued.findIndex((entry) => entry.id === id);
      const otherIndex = data.action === 'moveUp' ? index - 1 : index + 1;
      if (index >= 0 && queued[otherIndex]) [item.sortOrder, queued[otherIndex].sortOrder] = [queued[otherIndex].sortOrder, item.sortOrder];
    } else return json({ message: '未知操作' }, 400);
    await this.save(state);
    return json({ ok: true });
  }

  async addSong(request, state) {
    if (!await this.requireAdmin(request)) return json({ message: '主播登录已失效，请重新登录' }, 401);
    const data = await this.body(request);
    const title = cleanText(data.title, 80); const artist = cleanText(data.artist, 80);
    if (!title || !artist) return json({ message: '请填写歌名和歌手' }, 400);
    state.songs.push({ id: state.nextSongId++, title, artist, section: artist[0]?.toUpperCase() || '#', isChorus: Boolean(data.isChorus), note: cleanText(data.note, 120), isActive: true });
    await this.save(state);
    return json({ id: state.songs.at(-1).id }, 201);
  }

  async updateSong(request, state, id) {
    if (!await this.requireAdmin(request)) return json({ message: '主播登录已失效，请重新登录' }, 401);
    const data = await this.body(request); const song = state.songs.find((entry) => entry.id === id);
    if (!song) return json({ message: '歌曲不存在' }, 404);
    if ('title' in data) song.title = cleanText(data.title, 80);
    if ('artist' in data) song.artist = cleanText(data.artist, 80);
    if ('note' in data) song.note = cleanText(data.note, 120);
    if ('isChorus' in data) song.isChorus = Boolean(data.isChorus);
    if ('isActive' in data) song.isActive = Boolean(data.isActive);
    if (!song.title || !song.artist) return json({ message: '歌名和歌手不能为空' }, 400);
    await this.save(state); return json({ ok: true });
  }

  upgrade(request) {
    const pair = new WebSocketPair(); const client = pair[0]; const server = pair[1]; server.accept();
    this.clients.add(server);
    server.addEventListener('close', () => this.clients.delete(server));
    server.addEventListener('error', () => this.clients.delete(server));
    server.send(JSON.stringify({ type: 'state:update', at: Date.now() }));
    return new Response(null, { status: 101, webSocket: client });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/') || url.pathname === '/socket.io' || url.pathname.startsWith('/socket.io/')) {
      const origin = new URL(env.ORIGIN_URL || 'http://43.135.4.44');
      url.protocol = origin.protocol;
      url.hostname = origin.hostname;
      url.port = origin.port;
      const headers = new Headers(request.headers);
      headers.delete('host');
      return fetch(new Request(url.toString(), {
        method: request.method,
        headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
        redirect: 'manual',
      }));
    }
    return env.ASSETS.fetch(request);
  },
};
