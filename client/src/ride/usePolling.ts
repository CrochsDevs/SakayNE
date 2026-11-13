import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';
import { createPoller } from './polling.mjs';
// Focus scoped polling prevents abandoned screens from updating or overlapping requests.
export function usePolling<T>(loader: () => Promise<T>, initial: T, delay = 5000) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const latest = useRef(loader);
  useLayoutEffect(() => { latest.current = loader; }, [loader]);
  const poller = useRef<ReturnType<typeof createPoller<T>> | null>(null);
  useLayoutEffect(() => {
    const controller = createPoller<T>({
      load: () => latest.current(),
      onData: value => { setData(value); setError(''); },
      onError: e => setError(e instanceof Error ? e.message : 'Unable to load'),
      onSettled: () => setLoading(false),
    });
    poller.current = controller;
    return () => controller.stop();
  }, []);
  useLayoutEffect(() => { poller.current?.setDelay(delay); }, [delay]);
  const refresh = useCallback(() => poller.current?.refresh() || Promise.resolve(), []);
  useFocusEffect(useCallback(() => {
    const controller = poller.current;
    if (!controller) return;
    const sync = () => {
      if (AppState.currentState === 'background' || AppState.currentState === 'inactive') controller.stop();
      else void controller.start();
    };
    sync();
    const subscription = AppState.addEventListener('change', sync);
    return () => { controller.stop(); subscription.remove(); };
  }, []));
  return { data, loading, error, refresh, setData };
}
