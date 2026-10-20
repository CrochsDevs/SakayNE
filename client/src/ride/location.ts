import { Platform } from 'react-native';
import * as Location from 'expo-location';

export interface PositionSubscription { remove(): void; }
export interface PositionMetadata { accuracy: number | null; capturedAt: string; }
export async function watchDriverPosition(onPosition: (latitude: number, longitude: number, metadata: PositionMetadata) => void, onError: (message: string) => void): Promise<PositionSubscription> {
  if (Platform.OS === 'web') {
    if (!navigator.geolocation) throw new Error('This browser does not support GPS location');
    let active = true, busy = false;
    const sample = () => {
      if (!active || busy) return;
      busy = true;
      navigator.geolocation.getCurrentPosition(position => {
        busy = false;
        if (active) onPosition(position.coords.latitude, position.coords.longitude, { accuracy: position.coords.accuracy, capturedAt: new Date(position.timestamp).toISOString() });
      }, error => {
        busy = false;
        if (active) onError(error.code === 1 ? 'Enable location permission for automatic seat detection.' : 'GPS unavailable. Check your location settings.');
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    };
    sample(); const timer = setInterval(sample, 5000);
    return { remove: () => { active = false; clearInterval(timer); } };
  }
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('Enable location permission to share your GPS with passengers.');
  if (!await Location.hasServicesEnabledAsync()) throw new Error('Turn on your device location services.');
  let active = true, busy = false;
  const sample = async () => {
    if (busy || !active) return;
    busy = true;
    try {
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (active) onPosition(position.coords.latitude, position.coords.longitude, { accuracy: position.coords.accuracy, capturedAt: new Date(position.timestamp).toISOString() });
    } catch { if (active) onError('GPS unavailable. Check your location settings.'); }
    finally { busy = false; }
  };
  // Foreground samples avoid the SDK 54 legacy event-emitter cleanup issue.
  void sample(); const timer = setInterval(sample, 5000);
  return { remove: () => { active = false; clearInterval(timer); } };
}
