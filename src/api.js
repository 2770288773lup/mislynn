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
    // Both public domains use the same Socket.IO backend through the Worker proxy.
    socket = io({ autoConnect: true });
  }
  return socket;
}
import { io } from 'socket.io-client';
