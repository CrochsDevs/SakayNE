import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { watchDriverPosition, PositionSubscription } from './location';
import { getAuth } from '@/src/auth/auth.store';
import { getDriverProfile, heartbeat, publishLocation } from './driver.service';
import { getRides, isActiveRide } from './ride.store';

export default function DriverPresence() {
  const path = usePathname();
  const [message, setMessage] = useState('');
  useEffect(() => {
    let disposed = false, running = false, subscription: PositionSubscription | undefined;
    let lastSent = 0;
    const stop = () => { subscription?.remove(); subscription = undefined; };
    const sync = async () => {
      if (running) return;
      running = true;
      try {
        const { user, token } = await getAuth();
        if (!token || user?.role !== 'driver' || !user.verified) { stop(); if (!disposed) setMessage(''); return; }
        const driver = await getDriverProfile();
        const active = (await getRides()).some(isActiveRide);
        if (!driver.isAvailable && !active) { stop(); if (!disposed) setMessage(''); return; }
        if (driver.isAvailable) await heartbeat();
        if (!subscription && !disposed) {
          const watcher = await watchDriverPosition((latitude, longitude, metadata) => {
            if (disposed || Date.now() - lastSent < 4000) return;
            lastSent = Date.now();
            void publishLocation(latitude, longitude, metadata).then(() => { if (!disposed) setMessage(''); }).catch(error => { if (!disposed) setMessage(error instanceof Error ? error.message : 'GPS upload failed. Check your connection.'); });
          }, message => { if (!disposed) setMessage(message); });
          if (disposed) watcher.remove(); else subscription = watcher;
        }
      } catch(e) { if (!disposed) setMessage(e instanceof Error ? e.message : 'Driver connection unavailable'); }
      finally { running = false; }
    };
    void sync(); const timer = setInterval(sync, 25000);
    return () => { disposed = true; clearInterval(timer); stop(); };
  }, [path]);
  return message ? <View style={{ backgroundColor: '#FEF3C7', padding: 10 }}><Text style={{ color: '#92400E', fontSize: 12 }}>{message}</Text></View> : null;
}
