export async function api(path, options = {}) {
  const { token, body, ...fetchOptions } = options;
  const response = await fetch(path, {
    ...fetchOptions,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...fetchOptions.headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || '请求失败，请稍后再试');
    error.status = response.status;
    throw error;
  }
  return data;
}

let socket;

export function liveSocket() {
  if (!socket) {
    const listeners = new Set();
    let connection;
    let reconnectTimer;
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      connection = new WebSocket(`${protocol}//${window.location.host}/ws`);
      connection.addEventListener('message', (event) => {
        try { if (JSON.parse(event.data).type === 'state:update') listeners.forEach((listener) => listener()); } catch { /* ignore malformed heartbeat */ }
      });
      connection.addEventListener('close', () => { clearTimeout(reconnectTimer); reconnectTimer = setTimeout(connect, 3000); });
    };
    connect();
    socket = { on: (_event, listener) => listeners.add(listener), off: (_event, listener) => listeners.delete(listener) };
  }
  return socket;
}
