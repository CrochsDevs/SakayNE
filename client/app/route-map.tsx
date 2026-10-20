import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/src/store/theme';
import { showSuccess, showError } from '@/src/utils/toast';
import RouteMap, { MapStop, MapTown } from '@/src/components/map/RouteMap';
import { bookRide } from '@/src/ride/ride.store';
import { getAvailableDrivers } from '@/src/ride/driver.service';
import { usePolling } from '@/src/ride/usePolling';
import {
  TOWNS,
  SakayDriver,
  getRoute,
  getTown,
  fareForMinutes,
  buildSegment,
} from '@/src/data/sakay';

export default function RouteMapScreen() {
  const { isDark, colors } = useTheme();
  const { routeId, driverId, fromId, toId } = useLocalSearchParams<{
    routeId?: string;
    driverId?: string;
    fromId?: string;
    toId?: string;
  }>();

  const route = getRoute(routeId);
  const fleet = usePolling(getAvailableDrivers, [] as SakayDriver[]);
  const [seats, setSeats] = useState(1);
  const [requestId, setRequestId] = useState(() => `booking_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const driver = fleet.data.find((d) => d.id === driverId && d.routeId === routeId);
  const [showMap, setShowMap] = useState(false);
  const [booking, setBooking] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const segment = useMemo(() => route ? buildSegment(route, fromId, toId) : [], [route, fromId, toId]);

  const mapStops: MapStop[] = segment
    .map((s, i, arr) => {
      const town = getTown(s.townId);
      if (!town) return null;
      return {
        label: town.name,
        coord: { latitude: town.lat, longitude: town.lng },
        isOrigin: i === 0,
        isDestination: i === arr.length - 1,
        isOutside: s.isOutside,
      };
    })
    .filter(Boolean) as MapStop[];

  const mapTowns: MapTown[] = TOWNS.map((t) => ({ name: t.name, coord: { latitude: t.lat, longitude: t.lng } }));

  const totalMin = segment.length ? segment[segment.length - 1].minutes : 0;
  const fare = fareForMinutes(route?.type || 'jeep', totalMin) * seats;
  const bg = isDark ? '#1A1A2E' : '#fff';
  const canBook = !booking && !!driver && seats <= driver.seats && !fleet.error && !fleet.loading;

  const handleConfirm = async () => {
    if (!canBook || !route || !driver || segment.length < 2) return;
    setBooking(true);
    try {
      const ride = await bookRide({ routeId: route.id, driverId: driver.id, fromId: segment[0].townId, toId: segment[segment.length - 1].townId, seats, requestId });
      showSuccess('Booking requested', 'Waiting for driver confirmation');
      router.replace({ pathname: '/ride-tracking', params: { rideId: ride.id } });
    } catch (e) { showError(e instanceof Error ? e.message : 'Booking failed'); }
    finally { setBooking(false); }
  };
  if (!ready) return <SafeAreaView style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color="#3F8451" /></SafeAreaView>;
  if (!route || segment.length < 2) return <SafeAreaView style={{ flex: 1, padding: 24 }}><Text>Invalid route or stops. Please choose a ride again.</Text><TouchableOpacity onPress={() => router.back()}><Text>Go back</Text></TouchableOpacity></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity accessibilityRole="button" disabled={booking} onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
          <Text style={[styles.body, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>3. Check your booking</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>Check your trip, choose your seats, then confirm.</Text>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.primary }]}>{route.type === 'bus' ? 'Bus' : 'Jeepney'} · One-way trip</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>Get on at</Text>
          <Text style={[styles.place, { color: colors.text }]}>{segment[0].name}</Text>
          <Ionicons name="arrow-down" size={22} color={colors.primary} />
          <Text style={[styles.body, { color: colors.textSecondary }]}>Get off at</Text>
          <Text style={[styles.place, { color: colors.text }]}>{segment[segment.length - 1].name}</Text>
          {driver && <Text style={[styles.body, { color: colors.textSecondary }]}>Driver: {driver.name} · {driver.vehicle}</Text>}
        </View>

        <Text accessibilityRole="header" style={[styles.label, { color: colors.text }]}>How many seats do you need?</Text>
        <View style={styles.counter}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Remove seat" accessibilityState={{ disabled: booking || seats <= 1 }} disabled={booking || seats <= 1}
            onPress={() => { setSeats(seats - 1); setRequestId('booking_' + Date.now() + '_' + Math.random().toString(36).slice(2)); }}
            style={[styles.counterButton, { backgroundColor: colors.backgroundAlt, borderColor: colors.border, opacity: booking || seats <= 1 ? 0.4 : 1 }]}>
            <Text style={[styles.counterSymbol, { color: colors.text }]}>−</Text>
          </TouchableOpacity>
          <Text accessibilityLiveRegion="polite" style={[styles.place, { color: colors.text }]}>{seats} {seats === 1 ? 'seat' : 'seats'}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Add seat" accessibilityState={{ disabled: booking || seats >= Math.min(10, driver?.seats || 0) }} disabled={booking || seats >= Math.min(10, driver?.seats || 0)}
            onPress={() => { setSeats(seats + 1); setRequestId('booking_' + Date.now() + '_' + Math.random().toString(36).slice(2)); }}
            style={[styles.counterButton, { backgroundColor: colors.backgroundAlt, borderColor: colors.border, opacity: booking || seats >= Math.min(10, driver?.seats || 0) ? 0.4 : 1 }]}>
            <Text style={[styles.counterSymbol, { color: colors.text }]}>+</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.body, { color: colors.textSecondary }]}>Include yourself and anyone riding with you.</Text>

        <View style={[styles.card, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.text }]}>Estimated total fare</Text>
          <Text accessibilityLiveRegion="polite" style={[styles.fare, { color: colors.text }]}>₱{fare}</Text>
          <Text style={[styles.label, { color: colors.text }]}>Pay cash to the driver after your ride.</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>For {seats} {seats === 1 ? 'seat' : 'seats'} · About {totalMin} minutes of travel. Fare and travel time are estimates.</Text>
        </View>

        <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: showMap }} onPress={() => setShowMap(value => !value)} style={styles.mapToggle}>
          <Ionicons name="map-outline" size={24} color={colors.primary} />
          <Text style={[styles.label, { color: colors.text, flex: 1 }]}>{showMap ? 'Hide route map' : 'View route map'}</Text>
          <Ionicons name={showMap ? 'chevron-up' : 'chevron-down'} size={22} color={colors.text} />
        </TouchableOpacity>
        {showMap && <>
          <View style={styles.map}><RouteMap stops={mapStops} towns={mapTowns} servicePath={route.servicePath?.source ? route.servicePath.points : []} isDark={isDark} /></View>
          <Text style={[styles.body, { color: colors.textSecondary }]}>Map locations are approximate. Confirm the boarding place with your driver.</Text>
        </>}
        {fleet.loading && <Text style={[styles.body, { color: colors.textSecondary }]}>Checking available seats…</Text>}
        {!!fleet.error && <TouchableOpacity accessibilityRole="button" onPress={fleet.refresh} style={styles.mapToggle}><Text style={[styles.body, { color: colors.error }]}>Could not check seats. Tap to try again.</Text></TouchableOpacity>}
        {!fleet.loading && !fleet.error && !driver && <Text accessibilityRole="alert" style={[styles.body, { color: colors.error }]}>This vehicle is no longer available for your route. Go back to choose another vehicle.</Text>}
        {driver && seats > driver.seats && <Text accessibilityRole="alert" style={[styles.body, { color: colors.error }]}>Only {driver.seats} seats remain. Choose fewer seats or go back to choose another vehicle.</Text>}
      </ScrollView>
      <View style={[styles.footer, { backgroundColor: bg, borderColor: colors.border }]}>
        <Text accessibilityLiveRegion="polite" style={[styles.label, { color: colors.text, textAlign: 'center' }]}>Estimated total: ₱{fare} · Cash</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !canBook, busy: booking }} onPress={handleConfirm} disabled={!canBook}
          style={[styles.confirm, { backgroundColor: colors.primary, opacity: canBook ? 1 : 0.5 }]}>
          {booking && <ActivityIndicator color="#fff" />}
          <Text style={styles.confirmText}>{booking ? 'Sending booking…' : 'Confirm Booking'}</Text>
        </TouchableOpacity>
        <Text style={[styles.footerNote, { color: colors.textSecondary }]}>Your driver will confirm your request.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 24 },
  title: { fontSize: 26, fontWeight: '800' },
  body: { fontSize: 17, lineHeight: 25 },
  label: { fontSize: 18, fontWeight: '700', lineHeight: 26 },
  place: { fontSize: 21, fontWeight: '700', lineHeight: 29 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, alignSelf: 'flex-start', paddingRight: 16 },
  card: { borderRadius: 16, padding: 18, borderWidth: 1, gap: 8 },
  counter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  counterButton: { minWidth: 60, minHeight: 60, padding: 8, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  counterSymbol: { fontSize: 30, fontWeight: '600' },
  fare: { fontSize: 34, fontWeight: '800' },
  mapToggle: { minHeight: 56, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  map: { height: 280, borderRadius: 16, overflow: 'hidden' },
  footer: { padding: 16, gap: 8, borderTopWidth: 1 },
  confirm: { minHeight: 56, padding: 14, borderRadius: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', alignItems: 'center' },
  confirmText: { fontSize: 19, fontWeight: '700', color: '#fff', textAlign: 'center' },
  footerNote: { fontSize: 15, textAlign: 'center' },
});
