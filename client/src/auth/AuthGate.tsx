import { useEffect } from 'react';
import { router, useRootNavigationState, useSegments } from 'expo-router';
import { getAuth } from './auth.store';

export default function AuthGate() {
  const segments = useSegments();
  const ready = useRootNavigationState()?.key;
  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    const check = () => getAuth().then(({ user, token }) => {
      if (disposed) return;
      const first = String(segments[0] || '');
      const publicScreen = !first || ['welcome', '(auth)', 'driver-register', 'about', 'help-center', 'language'].includes(first);
      if (!publicScreen && (!token || !user)) { router.replace('/(auth)/login'); return; }
      if (!user || !token) return;
      const home = user.role === 'driver' ? '/(driver)' : user.role === 'admin' ? '/admin' : '/(passenger)/home';
      const wrongRole = first === '(driver)' && user.role !== 'driver' || first === '(passenger)' && user.role !== 'passenger' || first === 'admin' && user.role !== 'admin'
        || ['ride-tracking', 'route-map'].includes(first) && user.role !== 'passenger' || first === 'driver-trip' && user.role !== 'driver';
      if (wrongRole) router.replace(home);
    });
    void check();
    const timer = setInterval(check, 5000);
    return () => { disposed = true; clearInterval(timer); };
  }, [segments, ready]);
  return null;
}
