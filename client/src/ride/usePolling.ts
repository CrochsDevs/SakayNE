import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
// Focus scoped polling prevents abandoned screens from updating or overlapping requests.
export function usePolling<T>(loader: () => Promise<T>, initial: T, delay = 5000) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const latest = useRef(loader); latest.current = loader;
  const active = useRef(false);
  const busy = useRef(false);
  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try { const result = await latest.current(); if (active.current) { setData(result); setError(''); } }
    catch (e) { if (active.current) setError(e instanceof Error ? e.message : 'Unable to load'); }
    finally { busy.current = false; if (active.current) setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { active.current = true; void refresh(); const timer = setInterval(refresh, delay); return () => { active.current = false; clearInterval(timer); }; }, [refresh, delay]));
  return { data, loading, error, refresh };
}
