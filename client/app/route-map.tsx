import { useInterfaceText } from '@/src/i18n/useInterfaceText';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/src/store/theme';
import { showSuccess, showError } from '@/src/utils/toast';
import RouteMap from '@/src/components/map/ExpandableRouteMap';
import PickupAccuracyNotice from '@/src/components/PickupAccuracyNotice';
import TravelTimeEstimate from '@/src/components/TravelTimeEstimate';
import Avatar from '@/src/components/ui/Avatar';
import { type MapStop, type MapTown } from '@/src/components/map/RouteMap';
import { bookRide } from '@/src/ride/ride.store';
import { getAvailableDrivers } from '@/src/ride/driver.service';
import { usePolling } from '@/src/ride/usePolling';
import type { PickupLocation } from '@/src/ride/location';
import FeatureComingSoon from '@/src/components/FeatureComingSoon';
import { isServiceAvailable, BUS_COMING_SOON } from '@/src/data/service-availability.mjs';
import {
  TOWNS,
  SakayDriver,
  getRoute,
  getRoadWaypoints, isRouteMapEnabled,
  getRouteMapTown,
  buildSegment,
} from '@/src/data/sakay';

const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export default function RouteMapScreen() {
  const { isDark, colors } = useTheme();
  const translate = useInterfaceText();
  const { routeId, driverId, fromId, toId, seats: requestedSeats, pickupLat, pickupLng, pickupAccuracy, pickupCapturedAt } = useLocalSearchParams<{
    routeId?: string;
    driverId?: string;
    fromId?: string;
    toId?: string;
    seats?: string;
    pickupLat?: string; pickupLng?: string; pickupAccuracy?: string; pickupCapturedAt?: string;
  }>();
  const gpsPickupRequested = pickupLat !== undefined || pickupLng !== undefined || pickupAccuracy !== undefined || pickupCapturedAt !== undefined;
  const accuracy = pickupAccuracy === 'null' ? null : Number(pickupAccuracy);
  const pickupLocation: PickupLocation | undefined = pickupLat && pickupLng && pickupAccuracy && pickupCapturedAt
    && Number.isFinite(Number(pickupLat)) && Math.abs(Number(pickupLat)) <= 90
    && Number.isFinite(Number(pickupLng)) && Math.abs(Number(pickupLng)) <= 180
    && (accuracy === null || Number.isFinite(accuracy) && accuracy >= 0)
    && Number.isFinite(Date.parse(pickupCapturedAt))
    ? { latitude: Number(pickupLat), longitude: Number(pickupLng), accuracy, capturedAt: pickupCapturedAt } : undefined;

  const route = getRoute(routeId);
  const fleet = usePolling(getAvailableDrivers, [] as SakayDriver[]);
  const [seats, setSeats] = useState(() => requestedSeats && /^([1-9]|10)$/.test(requestedSeats) ? Number(requestedSeats) : 1);
  const [requestId, setRequestId] = useState(() => `booking_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const driver = fleet.data.find((d) => d.id === driverId && d.routeId === routeId);
  const [showMap, setShowMap] = useState(false);
  const [booking, setBooking] = useState(false);
  const ready = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);

  const segment = useMemo(() => route ? buildSegment(route, fromId, toId) : [], [route, fromId, toId]);

  const mapStops: MapStop[] = segment
    .map((s, i, arr) => {
      const town = getRouteMapTown(route, s.townId);
      if (!town) return null;
      return {
        label: i === 0 && pickupLocation ? translate('Current location') : town.name,
        coord: i === 0 && pickupLocation ? pickupLocation : { latitude: town.lat, longitude: town.lng },
        isLivePickup: i === 0 && !!pickupLocation,
        isOrigin: i === 0,
        isDestination: i === arr.length - 1,
        isOutside: s.isOutside,
      };
    })
    .filter(Boolean) as MapStop[];

  const mapTowns: MapTown[] = TOWNS.map((t) => ({ name: t.name, coord: { latitude: t.lat, longitude: t.lng } }));

  const totalMin = segment.length ? segment[segment.length - 1].minutes : 0;
  const bg = colors.background;
  const canBook = !booking && !!driver && seats <= driver.seats && !fleet.error && !fleet.loading && (!gpsPickupRequested || !!pickupLocation);

  const handleConfirm = async () => {
    if (!canBook || !route || !driver || segment.length < 2) return;
    setBooking(true);
    try {
      const ride = await bookRide({ routeId: route.id, driverId: driver.id, fromId: segment[0].townId, toId: segment[segment.length - 1].townId, seats, requestId, ...(pickupLocation ? { pickupLocation } : {}) });
      showSuccess(translate("Booking requested"), translate("Waiting for driver confirmation"));
      router.replace({ pathname: '/ride-tracking', params: { rideId: ride.id } });
    } catch (e) { showError(e instanceof Error ? e.message : translate("Booking failed")); }
    finally { setBooking(false); }
  };
  if (!ready) return <SafeAreaView style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color="#087F8C" /></SafeAreaView>;
  if (route && !isServiceAvailable(route.type)) return <FeatureComingSoon title="Bus service" icon="bus-outline" description={BUS_COMING_SOON} />;
  if (!route || segment.length < 2 || (gpsPickupRequested && !pickupLocation)) return <SafeAreaView style={{ flex: 1, padding: 24 }}><Text>{translate("Invalid route or stops. Please choose a ride again.")}</Text><TouchableOpacity onPress={() => router.back()}><Text>{translate("Go back")}</Text></TouchableOpacity></SafeAreaView>;

  return <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.navigation}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate('Go back')} disabled={booking} onPress={() => router.back()} style={styles.backButton}><View style={[styles.backIcon, { backgroundColor: colors.backgroundAlt }]}><Ionicons name="arrow-back" size={21} color={colors.text} /></View><Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>{translate('Back')}</Text></TouchableOpacity>
        <View style={[styles.step, { backgroundColor: colors.accentSurface }]}><Text style={{ color: colors.onAccent, fontSize: 10, fontWeight: '700' }}>{translate('Step 3 of 3')}</Text></View>
      </View>
      <View style={styles.heading}><Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{translate('Check your booking')}</Text><Text style={[styles.description, { color: colors.textSecondary }]}>{translate('Review your route and seats before confirming.')}</Text></View>
      <TravelTimeEstimate minutes={totalMin} summary />
      <View style={[styles.tripCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.tripHeader, { borderColor: colors.borderLight }]}><View style={styles.vehicleBadge}><Ionicons name="navigate-outline" size={16} color={colors.primaryLight} /><Text style={{ color: colors.primaryLight, fontSize: 13, fontWeight: '700' }}>{translate(route.type === 'bus' ? 'Bus' : 'Jeepney')}</Text></View><Text style={{ color: colors.textSecondary, fontSize: 11 }}>{translate('One-way trip')}</Text></View>
        <View style={styles.journey}>
          <View style={styles.railColumn}><Ionicons name="radio-button-on" size={17} color={colors.primaryLight} /><View style={[styles.rail, { backgroundColor: colors.border }]} /><Ionicons name="location" size={20} color={colors.onAccent} /></View>
          <View style={styles.grow}>
            <View style={[styles.stop, { borderColor: colors.borderLight }]}><Text style={[styles.stopLabel, { color: colors.textSecondary }]}>{translate('Pickup')}</Text><Text style={[styles.place, { color: colors.text }]}>{pickupLocation ? translate('Current location') : segment[0].name}</Text>{pickupLocation && <Text style={[styles.area, { color: colors.textSecondary }]}>{translate('Pickup area: {{name}}', { name: segment[0].name })}</Text>}</View>
            <View style={[styles.stop, styles.lastStop]}><Text style={[styles.stopLabel, { color: colors.textSecondary }]}>{translate('Drop-off')}</Text><Text style={[styles.place, { color: colors.text }]}>{segment[segment.length - 1].name}</Text></View>
          </View>
        </View>
        {pickupLocation && <PickupAccuracyNotice accuracy={pickupLocation.accuracy} />}
        {driver && <View style={[styles.driver, { borderColor: colors.borderLight }]}><Avatar name={driver.name} size={40} /><View style={styles.grow}><Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', lineHeight: 20 }}>{driver.name}</Text><Text style={[styles.area, { color: colors.textSecondary }]}>{driver.vehicle}</Text></View><Ionicons name="person-outline" size={18} color={colors.textTertiary} /></View>}
      </View>
      <View style={[styles.seatCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.seatRow}><View style={styles.grow}><Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{translate('Passenger seats')}</Text><Text style={[styles.area, { color: colors.textSecondary }]}>{translate('Include yourself')}</Text></View><View style={styles.counter}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate('Remove seat')} accessibilityState={{ disabled: booking || seats <= 1 }} disabled={booking || seats <= 1} onPress={() => { setSeats(seats - 1); setRequestId('booking_' + Date.now() + '_' + Math.random().toString(36).slice(2)); }} style={[styles.counterButton, { backgroundColor: colors.backgroundAlt, borderColor: colors.border, opacity: booking || seats <= 1 ? 0.4 : 1 }]}><Ionicons name="remove" size={21} color={colors.text} /></TouchableOpacity>
          <Text accessibilityLiveRegion="polite" accessibilityLabel={translate('{{count}} seat(s)', { count: seats })} style={{ color: colors.text, fontSize: 21, fontWeight: '800', minWidth: 25, textAlign: 'center' }}>{seats}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate('Add seat')} accessibilityState={{ disabled: booking || seats >= Math.min(10, driver?.seats || 0) }} disabled={booking || seats >= Math.min(10, driver?.seats || 0)} onPress={() => { setSeats(seats + 1); setRequestId('booking_' + Date.now() + '_' + Math.random().toString(36).slice(2)); }} style={[styles.counterButton, { backgroundColor: colors.mintSurface, borderColor: colors.border, opacity: booking || seats >= Math.min(10, driver?.seats || 0) ? 0.4 : 1 }]}><Ionicons name="add" size={21} color={colors.primaryLight} /></TouchableOpacity>
        </View></View>
        {fleet.loading && <Text style={[styles.description, { color: colors.textSecondary }]}>{translate('Checking available seats…')}</Text>}
        {!!fleet.error && <TouchableOpacity accessibilityRole="button" onPress={fleet.refresh} style={styles.retry}><Ionicons name="refresh" size={18} color={colors.error} /><Text style={[styles.description, { color: colors.error, flex: 1 }]}>{translate('Could not check seats. Tap to try again.')}</Text></TouchableOpacity>}
        {!fleet.loading && !fleet.error && !driver && <Text accessibilityRole="alert" style={[styles.description, { color: colors.error }]}>{translate('This vehicle is no longer available for your route. Go back to choose another vehicle.')}</Text>}
        {driver && seats > driver.seats && <Text accessibilityRole="alert" style={[styles.description, { color: colors.error }]}>{translate('Only {{count}} seats remain. Choose fewer seats or go back to choose another vehicle.', { count: driver.seats })}</Text>}
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate(showMap ? 'Hide route map' : 'View route map')} accessibilityState={{ expanded: showMap }} onPress={() => setShowMap(value => !value)} style={[styles.mapToggle, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={[styles.mapIcon, { backgroundColor: colors.mintSurface }]}><Ionicons name="map-outline" size={21} color={colors.primaryLight} /></View><Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 }}>{translate(showMap ? 'Hide route map' : 'View route map')}</Text><Ionicons name={showMap ? 'chevron-up' : 'chevron-forward'} size={18} color={colors.textSecondary} /></TouchableOpacity>
      {showMap && <><View style={styles.map}><RouteMap showRouteDetails={isRouteMapEnabled(route || undefined)} vehicleType={route?.type} stops={mapStops} routingWaypoints={getRoadWaypoints(route, fromId, toId, pickupLocation)} towns={mapTowns} servicePath={route.servicePath?.source ? route.servicePath.points : []} isDark={isDark} /></View><Text style={[styles.area, { color: colors.textSecondary }]}>{translate('Map locations are approximate. Confirm the boarding place with your driver.')}</Text></>}
      <Text style={[styles.estimateNote, { color: colors.textSecondary }]}>{translate('Based on the route plan. Traffic and stops can change the travel time.')}</Text>
    </ScrollView>
    <View style={[styles.footer, { backgroundColor: bg, borderColor: colors.border }]}><View style={styles.footerContent}>
      <TravelTimeEstimate minutes={totalMin} inline />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate(booking ? 'Sending booking…' : 'Confirm Booking')} accessibilityState={{ disabled: !canBook, busy: booking }} onPress={handleConfirm} disabled={!canBook} style={[styles.confirm, { backgroundColor: colors.primary, opacity: canBook ? 1 : 0.5 }]}>{booking ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="checkmark-circle-outline" size={21} color={colors.onPrimary} />}<Text style={{ color: colors.onPrimary, fontSize: 15, fontWeight: '700' }}>{translate(booking ? 'Sending booking…' : 'Confirm Booking')}</Text></TouchableOpacity>
      <Text style={[styles.footerNote, { color: colors.textSecondary }]}>{translate('Your driver will confirm your request.')}</Text>
    </View></View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 12, paddingBottom: 24, gap: 16, width: '100%', maxWidth: 680, alignSelf: 'center' },
  grow: { flex: 1, minWidth: 0 }, navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, backButton: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }, backIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, step: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
  heading: { gap: 6 }, title: { fontSize: 26, lineHeight: 33, fontWeight: '900', letterSpacing: -0.7 }, description: { fontSize: 13, lineHeight: 20 },
  tripCard: { borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingBottom: 15, gap: 10 }, tripHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingVertical: 13, borderBottomWidth: 1 }, vehicleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  journey: { flexDirection: 'row', gap: 12 }, railColumn: { paddingTop: 17, paddingBottom: 17, alignItems: 'center' }, rail: { flex: 1, width: 1, minHeight: 23, marginVertical: 5 }, stop: { paddingVertical: 10, gap: 3, borderBottomWidth: 1 }, lastStop: { borderBottomWidth: 0 }, stopLabel: { fontSize: 10, lineHeight: 15 }, place: { fontSize: 17, lineHeight: 24, fontWeight: '700' }, area: { fontSize: 11, lineHeight: 17 },
  driver: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, paddingTop: 13 },
  seatCard: { borderRadius: 20, borderWidth: 1, padding: 15, gap: 12 }, seatRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, counter: { flexDirection: 'row', alignItems: 'center', gap: 8 }, counterButton: { width: 44, height: 44, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, retry: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  mapToggle: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderRadius: 18, borderWidth: 1, minHeight: 64 }, mapIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, map: { height: 280, borderRadius: 20, overflow: 'hidden' }, estimateNote: { fontSize: 11, lineHeight: 17, textAlign: 'center' },
  footer: { borderTopWidth: 1 }, footerContent: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8, gap: 8 }, confirm: { minHeight: 50, padding: 12, borderRadius: 15, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8 }, footerNote: { fontSize: 10, lineHeight: 15, textAlign: 'center' },
});
