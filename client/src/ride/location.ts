import { Platform } from 'react-native';
import * as Location from 'expo-location';

export interface PositionSubscription { remove(): void; }
export interface PositionMetadata { accuracy: number | null; capturedAt: string; }
export interface PickupLocation extends PositionMetadata { latitude: number; longitude: number; }

// One GPS snapshot for the agreed pickup point, separate from live seat detection.
export async function getPickupPosition(): Promise<PickupLocation> {
  if (Platform.OS === 'web') {
    if (!navigator.geolocation) throw new Error('Location is unavailable on this device.');
    return new Promise((resolve, reject) => {
      let best: PickupLocation | null = null;
      let watchId: number | undefined;
      let finished = false;
      const finish = (error?: GeolocationPositionError) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
        if (best) resolve(best);
        else reject(new Error(error?.code === 1 ? 'Allow location access to use your current pickup.' : 'Could not get your location. Turn on GPS and try again.'));
      };
      const timer = setTimeout(() => finish(), 8000);
      const sample = (position: GeolocationPosition) => {
        if (finished) return;
        const { latitude, longitude, accuracy } = position.coords;
        if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return;
        const precision = Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null;
        if (!best || (precision !== null && (best.accuracy === null || precision < best.accuracy))) {
          best = { latitude, longitude, accuracy: precision, capturedAt: new Date(position.timestamp).toISOString() };
        }
        // Some browsers report an IP-based fix first, then a better device fix.
        // Wait briefly for improvement; keep a usable approximate fix on timeout.
        if (precision !== null && precision <= 100) finish();
      };
      const options = { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 };
      if (typeof navigator.geolocation.watchPosition === 'function') {
        watchId = navigator.geolocation.watchPosition(sample, finish, options);
        if (finished) navigator.geolocation.clearWatch(watchId);
      } else navigator.geolocation.getCurrentPosition(sample, finish, options);
    });
  }
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('Allow location access to use your current pickup.');
  if (!await Location.hasServicesEnabledAsync()) throw new Error('Could not get your location. Turn on GPS and try again.');
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, capturedAt: new Date(position.timestamp).toISOString() };
}
export async function watchForegroundPosition(onPosition: (latitude: number, longitude: number, metadata: PositionMetadata) => void, onError: (message: string) => void): Promise<PositionSubscription> {
  if (Platform.OS === 'web') {
    if (!navigator.geolocation) throw new Error('This browser does not support GPS location');
    let active = true;
    const watchId = navigator.geolocation.watchPosition(position => {
      if (!active) return;
      const { latitude, longitude, accuracy } = position.coords;
      if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return;
      onPosition(latitude, longitude, { accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null, capturedAt: new Date(position.timestamp).toISOString() });
    }, error => {
      if (active) onError(error.code === 1 ? 'Allow location access to show your location on the map.' : 'GPS unavailable. Check your location settings.');
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    return { remove: () => { active = false; navigator.geolocation.clearWatch(watchId); } };
  }
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('Allow location access to show your location on the map.');
  if (!await Location.hasServicesEnabledAsync()) throw new Error('Turn on your device location services.');
  let active = true;
  const subscription = await Location.watchPositionAsync({
    // Navigation accuracy requests the best continuous fix available, which
    // matters when the server compares two phones for automatic boarding.
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 2000,
    mayShowUserSettingsDialog: true,
  }, position => {
    if (!active) return;
    const { latitude, longitude, accuracy } = position.coords;
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return;
    onPosition(latitude, longitude, { accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null, capturedAt: new Date(position.timestamp).toISOString() });
  }, message => { if (active) onError(message || 'GPS unavailable. Check your location settings.'); });
  if (!active) subscription.remove();
  return { remove: () => { active = false; subscription.remove(); } };
}

export const watchDriverPosition = watchForegroundPosition;
