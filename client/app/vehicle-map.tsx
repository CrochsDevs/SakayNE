import { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import RouteMap from '@/src/components/map/ExpandableRouteMap';
import { getRoute, getRouteMapTown, getRoadWaypoints, isRouteMapEnabled, type SakayDriver } from '@/src/data/sakay';
import { getAvailableDrivers } from '@/src/ride/driver.service';
import { usePolling } from '@/src/ride/usePolling';
import { useInterfaceText } from '@/src/i18n/useInterfaceText';
import { useTheme } from '@/src/store/theme';
import { watchForegroundPosition, type PickupLocation, type PositionSubscription } from '@/src/ride/location';

const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export default function VehicleMapScreen() {
  const ready = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
  const { driverId, routeId } = useLocalSearchParams<{ driverId?: string; routeId?: string }>();
  const { colors, isDark } = useTheme();
  const translate = useInterfaceText();
  const fleet = usePolling(getAvailableDrivers, [] as SakayDriver[]);
  const driver = fleet.data.find(item => item.id === driverId && item.routeId === routeId);
  const route = getRoute(routeId);
  const [clock, setClock] = useState(() => Date.now());
  const [recenterKey, setRecenterKey] = useState(0);
  const [showPeopleKey, setShowPeopleKey] = useState(0);
  const [userLocation, setUserLocation] = useState<PickupLocation | null>(null);
  const [locationError, setLocationError] = useState('');
  const [locationAttempt, setLocationAttempt] = useState(0);
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) return;
    let active = true;
    let subscription: PositionSubscription | undefined;
    // This location stays on this device; viewing the map does not share it
    // with the driver or enable booking seat detection.
    void watchForegroundPosition((latitude, longitude, metadata) => {
      if (!active) return;
      setUserLocation({ latitude, longitude, ...metadata });
      setLocationError('');
    }, message => { if (active) setLocationError(message); }).then(watcher => {
      if (active) subscription = watcher;
      else watcher.remove();
    }).catch(error => { if (active) setLocationError(error instanceof Error ? error.message : 'GPS unavailable. Check your location settings.'); });
    return () => { active = false; subscription?.remove(); };
  }, [focused, locationAttempt]);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  // A failed fleet refresh cannot confirm that a driver is still online.
  const location = !fleet.error ? driver?.location : null;
  const age = location ? clock - Date.parse(location.capturedAt || location.updatedAt) : Infinity;
  const fresh = age >= -5000 && age < 60000;
  const stops = (route?.stops || []).flatMap((stop, index, all) => {
    const town = getRouteMapTown(route, stop.townId);
    return town ? [{ label: town.name, coord: { latitude: town.lat, longitude: town.lng }, isOrigin: index === 0, isDestination: index === all.length - 1 }] : [];
  });
  const status = fleet.error ? translate('Unable to update vehicle location. Tap to retry.')
    : fleet.loading ? translate('Finding vehicle location…')
    : !driver ? translate('This vehicle is no longer online. Location sharing has stopped.')
    : !location ? translate(isRouteMapEnabled(route) ? 'Waiting for driver GPS. Route preview is shown.' : 'Waiting for driver GPS.')
    : !fresh ? translate('Driver location is outdated. Waiting for a fresh GPS update.')
    : translate('Driver GPS updated {{time}}', { time: new Date(location.updatedAt).toLocaleTimeString(translate('dateLocale')) });

  if (!ready) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.primaryLight} /></SafeAreaView>;

  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={styles.header}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate('Go back')} onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={24} color={colors.text} /></TouchableOpacity>
      <View style={{ flex: 1 }}><Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{translate(route?.type === 'bus' ? 'Bus location' : 'Jeepney location')}</Text><Text style={{ color: colors.textSecondary }}>{driver ? `${driver.name} · ${driver.vehicle}` : route?.label}</Text></View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate('Center on driver')} disabled={!location} onPress={() => setRecenterKey(value => value + 1)} style={[styles.back, { opacity: location ? 1 : 0.4 }]}><Ionicons name="locate-outline" size={24} color={colors.primaryLight} /></TouchableOpacity>
    </View>
    <View style={[styles.status, { backgroundColor: colors.card }]}>
      {fleet.loading ? <ActivityIndicator color={colors.primaryLight} /> : <Ionicons name={fresh ? 'radio-button-on' : 'information-circle-outline'} size={20} color={colors.primaryLight} />}
      <Text accessibilityLiveRegion="polite" style={{ flex: 1, color: colors.textSecondary, lineHeight: 21 }}>{status}</Text>
      {!!fleet.error && <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate('Try again')} onPress={fleet.refresh} style={styles.back}><Ionicons name="refresh" size={22} color={colors.primaryLight} /></TouchableOpacity>}
    </View>
    <View style={styles.userStatus}>
      <View style={styles.legend}><View style={styles.userDot} /><Text style={{ color: colors.textSecondary }}>{translate('You')}</Text>{route?.type === 'jeep' ? <Image source={require('../assets/icon/jeepney.png')} tintColor={colors.primaryLight} style={{ width: 20, height: 20 }} resizeMode="contain" /> : <Ionicons name="bus-outline" size={18} color={colors.primaryLight} />}<Text style={{ color: colors.textSecondary }}>{translate('Driver')}</Text></View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate('Show both locations')} disabled={!userLocation && !location} onPress={() => setShowPeopleKey(value => value + 1)} style={styles.showBoth}><Text style={{ color: colors.primaryLight, fontWeight: '700' }}>{translate('Show both locations')}</Text></TouchableOpacity>
    </View>
    {!!locationError ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate('Retry my location')} onPress={() => setLocationAttempt(value => value + 1)} style={styles.locationNotice}><Text style={{ color: colors.error, fontSize: 12 }}>{translate(locationError)} {translate('Tap to retry.')}</Text></TouchableOpacity>
      : !userLocation ? <Text style={[styles.locationNotice, { color: colors.textSecondary }]}>{translate('Finding your location…')}</Text>
      : clock - Date.parse(userLocation.capturedAt) >= 60000 ? <Text style={[styles.locationNotice, { color: colors.textSecondary }]}>{translate('Your location is outdated. Waiting for a fresh GPS update.')}</Text> : null}
    <View style={{ flex: 1 }}><RouteMap showRouteDetails={isRouteMapEnabled(route || undefined)} vehicleType={route?.type} stops={stops} routingWaypoints={getRoadWaypoints(route)} driverLocation={location} userLocation={userLocation} followDriver recenterKey={recenterKey} showPeopleKey={showPeopleKey} servicePath={route?.servicePath?.source ? route.servicePath.points : []} isDark={isDark} /></View>
    <Text style={[styles.note, { color: colors.textSecondary }]}>{translate('Vehicle location refreshes every 5 seconds while this screen is open.')}</Text>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 21, fontWeight: '800', marginBottom: 4 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  note: { fontSize: 12, lineHeight: 18, padding: 14, textAlign: 'center' },
  userStatus: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, gap: 8 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2879E3' },
  showBoth: { minHeight: 44, justifyContent: 'center' },
  locationNotice: { paddingHorizontal: 16, paddingVertical: 8, fontSize: 12 },
});
