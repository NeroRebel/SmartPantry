import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { subscribeLocalChanges } from '@/db/local-state';

export function useFocusedData<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshRef = useRef<() => void>(() => {});

  useFocusEffect(useCallback(() => {
    let active = true;
    let request = 0;
    const refresh = async () => {
      if (!active) return;
      const current = ++request;
      setLoading(true);
      setError(null);
      try {
        const result = await load();
        if (active && current === request) setData(result);
      } catch (cause) {
        if (__DEV__) console.error('[SmartPantry] Database load failed:', cause);
        if (active && current === request) setError('Unable to load your pantry. Please try again.');
      } finally {
        if (active && current === request) setLoading(false);
      }
    };
    refreshRef.current = () => void refresh();
    void refresh();
    const unsubscribeData = subscribeLocalChanges(() => { void refresh(); });
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    let timer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(() => {
        void refresh();
        scheduleMidnight();
      }, midnight.getTime() - Date.now() + 100);
    };
    scheduleMidnight();
    return () => {
      active = false;
      subscription.remove();
      unsubscribeData();
      clearTimeout(timer);
    };
  }, [load]));

  return { data, setData, loading, error, reload: () => refreshRef.current() };
}
