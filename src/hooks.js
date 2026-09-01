import { useCallback, useEffect, useState } from 'react';
import { api, liveSocket } from './api.js';

export function useLiveState({ admin = false, token = '' } = {}) {
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (admin && !token) return;
    try {
      const nextState = await api(admin ? '/api/admin/state' : '/api/state', { token });
      setState(nextState);
      setError('');
    } catch (nextError) {
      setError(nextError.message);
      if (nextError.status === 401 && admin) setState(null);
    } finally {
      setLoading(false);
    }
  }, [admin, token]);

  useEffect(() => {
    refresh();
    const socket = liveSocket();
    const onUpdate = () => refresh();
    socket.on('state:update', onUpdate);
    const interval = window.setInterval(refresh, 30_000);
    return () => {
      socket.off('state:update', onUpdate);
      window.clearInterval(interval);
    };
  }, [refresh]);

  return { state, error, loading, refresh };
}

export function useToast() {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, kind = 'success') => {
    setToast({ message, kind, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return { toast, showToast };
}
