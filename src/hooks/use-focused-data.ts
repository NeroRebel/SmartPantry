import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { subscribeLocalChanges } from '@/db/local-state';
import { remoteErrorKey } from '@/utils/load-error';

export function useFocusedData<T>(load: () => Promise<T>, { localChanges = true, midnight = true, remote = false } = {}) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshRef = useRef<() => void>(() => {});

  useFocusEffect(useCallback(() => {
    let active = true;
    let request = 0;
    let running = false;
    let pending = false;
    let dataTimer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      if (!active) return;
      if (running) { pending = true; return; }
      running = true;
      const current = ++request;
      setLoading(true);
      setError(null);
      try {
        const result = await load();
        if (active && current === request) setData(result);
      } catch (cause) {
        if (active && current === request) setError(remote ? remoteErrorKey(cause) : 'polish.loadError');
      } finally {
        running = false;
        if (active && current === request) setLoading(false);
        if (active && pending) { pending = false; void refresh(); }
      }
    };
    refreshRef.current = () => void refresh();
    void refresh();
    const unsubscribeData = subscribeLocalChanges((reason) => {
      if (!localChanges && reason !== 'account') return;
      clearTimeout(dataTimer);
      dataTimer = setTimeout(() => { void refresh(); }, 80);
    });
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleMidnight = () => {
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(() => {
        void refresh();
        scheduleMidnight();
      }, midnight.getTime() - Date.now() + 100);
    };
    if (midnight) scheduleMidnight();
    return () => {
      active = false;
      subscription.remove();
      unsubscribeData();
      clearTimeout(timer);
      clearTimeout(dataTimer);
    };
  }, [load, localChanges, midnight, remote]));

  return { data, setData, loading, error, reload: () => refreshRef.current() };
}
