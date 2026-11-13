import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { getAuth } from '@/src/auth/auth.store';
import { getActiveRide, publishPassengerLocation } from './ride.store';
import { watchDriverPosition, PositionSubscription } from './location';
import { useAppForeground } from './useAppForeground';

export default function PassengerPresence() {
  const path = usePathname();
  const foreground = useAppForeground();
  const [message, setMessage] = useState('');
  const uploading = useRef(false);
  useEffect(() => {
    if (!foreground) return;
    let disposed = false, running = false;
    let subscription: PositionSubscription | undefined, rideId: string | undefined;
    const stop = () => { subscription?.remove(); subscription = undefined; rideId = undefined; };
    const sync = async () => {
      if (running) return;
      running = true;
      try {
        const { user, token } = await getAuth();
        if (disposed) return;
        if (!token || user?.role !== 'passenger') { stop(); if (!disposed) setMessage(''); return; }
        const ride = await getActiveRide();
        if (disposed) return;
        if (!ride?.geoTrackingEnabled || ride.occupancyStatus === 'alighted') { stop(); if (!disposed) setMessage(''); return; }
        if (rideId !== ride.id) stop();
        if (!subscription && !disposed) {
          rideId = ride.id;
          const watcher = await watchDriverPosition((latitude, longitude, metadata) => {
            if (disposed || uploading.current) return;
            uploading.current = true;
            void publishPassengerLocation(ride.id, latitude, longitude, metadata)
              .then(result => { if (result.trackingClosed) stop(); if (!disposed) setMessage(''); })
              .catch(error => { if (!disposed) setMessage(error instanceof Error ? error.message : 'Passenger GPS could not update. Keep the app open and check your connection.'); })
              .finally(() => { uploading.current = false; });
          }, text => { if (!disposed) setMessage(text); });
          if (disposed) watcher.remove(); else subscription = watcher;
        }
      } catch (error) { if (!disposed) setMessage(error instanceof Error ? error.message : 'Automatic seat detection unavailable'); }
      finally { running = false; }
    };
    void sync(); const timer = setInterval(sync, 5000);
    return () => { disposed = true; clearInterval(timer); stop(); };
  }, [path, foreground]);
  return message ? <View style={{ backgroundColor: '#FEF3C7', padding: 10 }}><Text style={{ color: '#92400E', fontSize: 12 }}>{message}</Text></View> : null;
}
