import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Card, Label, Action } from '@/src/components/ui/Screen';
import RouteMap from '@/src/components/map/RouteMap';
import { useTheme } from '@/src/store/theme';
import { getDriverProfile, setDriverAvailability } from '@/src/ride/driver.service';
import { getRides, changeRideStatus, RideStatus, isActiveRide } from '@/src/ride/ride.store';
import { usePolling } from '@/src/ride/usePolling';
import { ROUTES, getRoute, getServiceStops, getTownName } from '@/src/data/sakay';
import { showError } from '@/src/utils/toast';

const nextAction: Partial<Record<RideStatus, { status: RideStatus; title: string }>> = {
  pending: { status: 'accepted', title: 'Accept booking' },
  accepted: { status: 'arrived', title: 'Arrived at pickup' },
  arrived: { status: 'ongoing', title: 'Verify code & board passenger' },
  ongoing: { status: 'completed', title: 'Passenger alighted · Confirm cash' },
};

export default function DriverDashboard() {
  const { colors, isDark } = useTheme();
  const { height } = useWindowDimensions();
  const { data, error, loading, refresh } = usePolling(async () => ({
    driver: await getDriverProfile(), rides: await getRides(),
  }), null as { driver: Awaited<ReturnType<typeof getDriverProfile>>; rides: Awaited<ReturnType<typeof getRides>> } | null);
  const [routeId, setRouteId] = useState('');
  const [capacity, setCapacity] = useState('');
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showStops, setShowStops] = useState(false);
  const [selectedRideId, setSelectedRideId] = useState('');
  const [recenterKey, setRecenterKey] = useState(0);
  const driver = data?.driver;
  const routes = ROUTES.filter(r => r.type === (driver?.vehicleType === 'bus' ? 'bus' : 'jeep'));
  const active = data?.rides.filter(isActiveRide) || [];
  const chosen = active.length || driver?.isAvailable
    ? driver?.routeId || active[0]?.routeId || ''
    : routeId || driver?.routeId || routes[0]?.id || '';
  const seats = capacity || String(driver?.capacity || (driver?.vehicleType === 'bus' ? 45 : 16));
  const selectedRide = active.find(ride => ride.id === selectedRideId) || active.find(ride => ride.status !== 'pending') || active[0];
  const mapRoute = getRoute(chosen);
  const serviceStops = getServiceStops(mapRoute);
  const stops = serviceStops.map((stop, index) => ({ label: `${index + 1}. ${stop.name}`, coord: { latitude: stop.lat, longitude: stop.lng }, isOrigin: index === 0, isDestination: index === serviceStops.length - 1 }));
  const direction = mapRoute ? `${getTownName(mapRoute.originId)} → ${getTownName(mapRoute.destinationId)}` : 'Choose a route';
  const location = driver?.location || selectedRide?.driverLocation;
  const driverLocation = location && (driver?.isAvailable || active.length > 0)
    && Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90
    && Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180 ? location : null;
  const completed = data?.rides.filter(ride => ride.status === 'completed').slice(0, 10) || [];

  const act = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); await refresh(); }
    catch (e) { showError(e instanceof Error ? e.message : 'Request failed'); }
    finally { setBusy(false); }
  };
  const openRouteSettings = () => { setShowSettings(value => !value); setExpanded(true); };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.map} testID="driver-home-map">
        <RouteMap stops={stops} servicePath={mapRoute?.servicePath?.source ? mapRoute.servicePath.points : []} isDark={isDark} driverLocation={driverLocation} recenterKey={recenterKey} />
        <View pointerEvents="box-none" style={styles.mapHeader}>
          <View style={[styles.headerCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <View style={[styles.brandIcon, { backgroundColor: colors.primary }]}><Ionicons name="navigate" size={21} color="#fff" /></View>
            <View style={styles.grow}>
              <Text style={[styles.brand, { color: colors.text }]}>SakayNE <Text style={{ color: colors.primary }}>Driver</Text></Text>
              <Text style={[styles.caption, { color: colors.textSecondary }]}>{driver?.fullName || 'Your route, at a glance'}</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Messages" onPress={() => router.push('/messages')} style={[styles.iconButton, { backgroundColor: colors.backgroundAlt }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => router.push('/notifications-list')} style={[styles.iconButton, { backgroundColor: colors.backgroundAlt }]}>
              <Ionicons name="notifications-outline" size={21} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View pointerEvents="box-none" style={styles.mapTools}>
            <View style={[styles.gpsBadge, { backgroundColor: colors.surface }]}>
              <View style={[styles.dot, { backgroundColor: driverLocation ? colors.primary : colors.textTertiary }]} />
              <Text style={[styles.caption, { color: colors.textSecondary }]}>{driverLocation ? 'Driver GPS' : driver?.isAvailable || active.length ? 'Waiting for GPS' : 'Route preview'}</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={driverLocation ? 'Center map on my location' : 'Fit route on map'} onPress={() => setRecenterKey(value => value + 1)} style={[styles.iconButton, styles.shadow, { backgroundColor: colors.surface }]}>
              <Ionicons name={driverLocation ? 'locate' : 'scan-outline'} size={23} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Route: ${mapRoute?.label || 'Choose a route'}`} onPress={openRouteSettings} style={[styles.routeBadge, styles.shadow, { backgroundColor: '#092E26' }]}>
          <Ionicons name="arrow-forward" size={22} color="#55D6AC" />
          <View style={styles.grow}>
            <Text style={[styles.routeEyebrow, { color: '#A5DCCD' }]}>ONE-WAY · {driver?.vehicleType === 'bus' ? 'BUS' : 'JEEPNEY'} ROUTE</Text>
            <Text numberOfLines={2} style={[styles.routeName, { color: '#FFFFFF' }]}>{direction}</Text>
          </View>
          <Ionicons name="chevron-up" size={17} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={[styles.panel, { backgroundColor: colors.surface, height: expanded ? Math.min(560, height * 0.65) : Math.min(210, Math.max(170, height * 0.24)) }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={expanded ? 'Collapse driver panel' : 'Expand driver panel'} accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={styles.handleTouch}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </TouchableOpacity>
        <View style={styles.panelHeader}>
          <View style={styles.grow}>
            <Text style={[styles.heading, { color: colors.text }]}>Driver trips</Text>
            <View style={styles.statusLine}>
              <View style={[styles.dot, { backgroundColor: driver?.isAvailable ? colors.primary : colors.textTertiary }]} />
              <Text style={[styles.status, { color: driver?.isAvailable ? colors.primary : colors.textSecondary }]}>{driver?.isAvailable ? 'ONLINE · accepting bookings' : 'OFFLINE'}</Text>
            </View>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={driver?.isAvailable ? 'Go offline' : 'Go online'} disabled={!driver || busy} onPress={() => {
            if (!driver) return;
            const vehicleCapacity = active.length ? driver.capacity || Number(seats) : Number(seats);
            void act(() => setDriverAvailability(!driver.isAvailable, chosen, vehicleCapacity));
          }} style={[styles.onlineButton, { backgroundColor: driver?.isAvailable ? colors.backgroundAlt : colors.primary, opacity: !driver || busy ? 0.5 : 1 }]}>
            {busy ? <ActivityIndicator size="small" color={driver?.isAvailable ? colors.text : '#fff'} /> : <Ionicons name="power" size={18} color={driver?.isAvailable ? colors.text : '#fff'} />}
            <Text style={[styles.onlineText, { color: driver?.isAvailable ? colors.text : '#fff' }]}>{driver?.isAvailable ? 'Go offline' : 'Go online'}</Text>
          </TouchableOpacity>
        </View>
        {!expanded && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Show bookings and trip details" onPress={() => setExpanded(true)} style={[styles.compactSummary, { backgroundColor: colors.backgroundAlt }]}>
          <Ionicons name={error ? 'alert-circle-outline' : 'people-outline'} size={22} color={colors.primary} />
          <View style={styles.grow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{loading ? 'Loading trips…' : error ? 'Unable to load trips' : `${active.length} active bookings`}</Text>
            <Text style={[styles.caption, { color: colors.textSecondary }]}>Tap to view trip details</Text>
          </View>
          <Ionicons name="chevron-up" size={22} color={colors.primary} />
        </TouchableOpacity>}
        {expanded && <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={styles.panelContent}>
          {loading && <ActivityIndicator color={colors.primary} />}
          {!!error && <Card><Label>{error}</Label><Action title="Retry" onPress={refresh} /></Card>}
          {driver && <>
            <View style={[styles.serviceBanner, { backgroundColor: isDark ? '#163C32' : '#D9EFE7' }]}>
              <Ionicons name="arrow-forward-circle" size={30} color={isDark ? '#55D6AC' : '#00865F'} />
              <View style={styles.grow}>
                <Text style={[styles.sectionTitle, { color: isDark ? '#55D6AC' : '#00865F' }]}>{driver.isAvailable ? 'Serving your one-way route' : 'Ready for your next route'}</Text>
                <Text style={[styles.caption, { color: colors.textSecondary }]}>Board and drop off along this direction</Text>
              </View>
            </View>
            <View style={[styles.vehicleCard, { borderColor: colors.borderLight }]}>
              <View style={[styles.vehicleIcon, { backgroundColor: isDark ? '#163C32' : '#EBF7F2' }]}><Ionicons name="bus-outline" size={38} color={colors.primary} /></View>
              <View style={styles.grow}>
                <Text style={[styles.vehiclePlate, { color: colors.text }]}>{driver.plateNo}</Text>
                <Text style={[styles.caption, { color: colors.textSecondary }]}>{driver.vehicleType === 'bus' ? 'Bus' : 'Jeepney'} · {driver.capacity || seats} passenger seats</Text>
                <Text style={[styles.caption, { color: colors.textSecondary }]}>{driver.fullName}</Text>
              </View>
            </View>
            <View style={[styles.seatSummary, { backgroundColor: colors.backgroundAlt }]}>
              <Ionicons name="people-outline" size={18} color={colors.primary} />
              <View style={styles.grow}>
                <Text style={[styles.seatText, { color: colors.text }]}>{driver.occupiedSeats || 0} occupied · {driver.waitingSeats || 0} waiting · {driver.availableSeats ?? 0} available</Text>
                <Text style={[styles.caption, { color: colors.textSecondary }]}>{driver.plateNo} · {driver.reservedSeats || 0} reserved seats</Text>
              </View>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: showStops }} onPress={() => { setShowStops(value => !value); setExpanded(true); }} style={styles.sectionLink}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Route stops · {serviceStops.length ? serviceStops.length : 'Awaiting verification'}</Text>
              <Ionicons name={showStops ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
            </TouchableOpacity>
            {!serviceStops.length && <Text style={[styles.emptyText, { color: colors.textSecondary, textAlign: 'left' }]}>Exact boarding stops and the service path are not yet verified for this route.</Text>}
            {showStops && <Card>
              <Label strong>{direction}</Label>
              {serviceStops.map((stop, index) => <View key={stop.id} style={styles.stopRow}>
                <View style={[styles.stopNumber, { backgroundColor: colors.primary }]}><Text style={{ color: '#FFF', fontWeight: '700' }}>{index + 1}</Text></View>
                <View style={styles.grow}><Label strong>{stop.name}</Label><Label>{index === 0 ? 'Departure' : index === serviceStops.length - 1 ? 'End of route' : 'Boarding / alighting'}</Label></View>
              </View>)}
              <Label>Finish this direction before choosing a separate return route. Completing a passenger booking does not reverse your route.</Label>
            </Card>}
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Route and vehicle capacity" accessibilityState={{ expanded: showSettings }} onPress={openRouteSettings} style={styles.sectionLink}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Route & capacity</Text>
              <Ionicons name={showSettings ? 'chevron-up' : 'options-outline'} size={18} color={colors.primary} />
            </TouchableOpacity>
            {showSettings && <Card>
              <Label>Choose the direction you are serving</Label>
              {routes.map(route => <Action key={route.id} title={(chosen === route.id ? '✓ ' : '') + `${getTownName(route.originId)} → ${getTownName(route.destinationId)}`} disabled={busy || active.length > 0 || driver.isAvailable} secondary={chosen !== route.id} onPress={() => setRouteId(route.id)} />)}
              <Label>Total vehicle capacity</Label>
              <TextInput accessibilityLabel="Vehicle seat capacity" value={seats} onChangeText={setCapacity} editable={!busy && !active.length && !driver.isAvailable} keyboardType="number-pad" style={[styles.input, { backgroundColor: colors.backgroundAlt, color: colors.text }]} />
              <Label>{active.length ? 'Finish existing bookings before changing your route or capacity.' : driver.isAvailable ? 'Go offline before selecting another direction or changing capacity.' : 'Your selected route and capacity are applied when you go online.'}</Label>
            </Card>}
          </>}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Active bookings ({active.length})</Text>
          {active.length === 0 && !loading && <View style={[styles.emptyState, { backgroundColor: colors.backgroundAlt }]}>
            <Ionicons name={driver?.isAvailable ? 'radio-outline' : 'navigate-outline'} size={27} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{driver?.isAvailable ? 'Ready for your next pickup' : 'Your next trip starts here'}</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{driver?.isAvailable ? 'Waiting for booking requests. Keep SakayNE open to share GPS.' : 'Go online to receive bookings and share your driver location.'}</Text>
          </View>}
          {active.map(ride => <View key={ride.id} style={[styles.booking, { backgroundColor: colors.card, borderColor: selectedRide?.id === ride.id ? colors.primary : colors.border }]}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Select ${ride.passengerName || 'passenger'} booking`} accessibilityState={{ selected: selectedRide?.id === ride.id }} onPress={() => setSelectedRideId(ride.id)} style={styles.bookingHeader}>
              <View style={[styles.avatar, { backgroundColor: colors.backgroundAlt }]}><Ionicons name="person-outline" size={20} color={colors.primary} /></View>
              <View style={styles.grow}>
                <Text style={[styles.routeName, { color: colors.text }]}>{ride.passengerName} · {ride.seats} seat(s)</Text>
                <Text style={[styles.caption, { color: colors.primary }]}>{ride.status.toUpperCase()} · ₱{ride.fare} cash</Text>
              </View>
              <Ionicons name="map-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
            <Label strong>{ride.fromName} → {ride.toName}</Label>
            <Label>{ride.occupancyStatus === 'alighted' ? 'Passenger alighted · seats released · cash confirmation pending' : ride.status === 'ongoing' ? 'Passenger on board' + (ride.boardingSource === 'geolocation' ? ' · detected by GPS' : '') : 'Seats reserved · waiting to board'}</Label>
            <Action secondary title="Passenger trip details" onPress={() => router.push({ pathname: '/driver-trip', params: { rideId: ride.id } })} />
            <Action secondary title="Message passenger" onPress={() => router.push({ pathname: '/ride-chat', params: { rideId: ride.id } })} />
            {ride.status === 'arrived' && <TextInput accessibilityLabel="Passenger boarding code" placeholder="Passenger boarding code" placeholderTextColor={colors.textTertiary} value={codes[ride.id] || ''} onChangeText={code => setCodes(previous => ({ ...previous, [ride.id]: code }))} autoCapitalize="characters" style={[styles.input, { backgroundColor: colors.backgroundAlt, color: colors.text }]} />}
            {nextAction[ride.status] && <Action disabled={busy} title={nextAction[ride.status]!.title} onPress={() => { void act(() => changeRideStatus(ride.id, nextAction[ride.status]!.status, codes[ride.id])); }} />}
            {ride.status !== 'ongoing' && <Action disabled={busy} secondary title={ride.status === 'pending' ? 'Decline booking' : 'Cancel booking'} onPress={() => { void act(() => changeRideStatus(ride.id, 'cancelled')); }} />}
          </View>)}
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: showHistory }} onPress={() => { setShowHistory(value => !value); setExpanded(true); }} style={styles.sectionLink}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent completed trips</Text>
            <Ionicons name={showHistory ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          {showHistory && (completed.length ? completed.map(ride => <Card key={ride.id}><Label>{ride.fromName} → {ride.toName}</Label><Label>₱{ride.fare} · {ride.seats} seat(s) · {ride.rating ? `${ride.rating}★` : 'Not rated'}</Label></Card>) : <Label>No completed trips yet.</Label>)}
        </ScrollView>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  compactSummary: { marginHorizontal: 16, padding: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  serviceBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 12 },
  vehicleCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, padding: 14, borderRadius: 16 },
  vehicleIcon: { width: 72, height: 64, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  vehiclePlate: { fontSize: 19, fontWeight: '700', marginBottom: 3 },
  stopRow: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 6 },
  stopNumber: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  screen: { flex: 1 }, map: { flex: 1, minHeight: 160 },
  mapHeader: { position: 'absolute', top: 14, left: 14, right: 14, gap: 10 },
  headerCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 20, borderWidth: 1, elevation: 3 },
  brandIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 }, caption: { fontSize: 11, lineHeight: 17 }, grow: { flex: 1, minWidth: 0 },
  iconButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  mapTools: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  gpsBadge: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingVertical: 7, paddingHorizontal: 10, borderRadius: 20 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  shadow: { shadowColor: '#0D1F16', shadowOpacity: 0.12, shadowOffset: { width: 0, height: 3 }, shadowRadius: 10, elevation: 3 },
  routeBadge: { position: 'absolute', bottom: 28, left: 14, right: 62, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeEyebrow: { fontSize: 9, letterSpacing: 1.4, fontWeight: '700', marginBottom: 3 }, routeName: { fontSize: 13, fontWeight: '700', lineHeight: 19 },
  panel: { borderTopLeftRadius: 26, borderTopRightRadius: 26, shadowColor: '#0D1F16', shadowOpacity: 0.1, shadowOffset: { width: 0, height: -4 }, shadowRadius: 16, elevation: 8 },
  handleTouch: { alignItems: 'center', paddingTop: 10, paddingBottom: 10 }, handle: { width: 36, height: 4, borderRadius: 3 },
  panelHeader: { paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  heading: { fontSize: 23, fontWeight: '800', letterSpacing: -0.6 }, statusLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 }, status: { fontSize: 10, fontWeight: '700' },
  onlineButton: { minWidth: 112, minHeight: 47, borderRadius: 15, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, onlineText: { fontSize: 12, fontWeight: '800' },
  panelContent: { paddingHorizontal: 20, paddingBottom: 28, gap: 14 },
  seatSummary: { borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, seatText: { fontSize: 11, fontWeight: '700', lineHeight: 18 },
  sectionLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 }, sectionTitle: { fontSize: 14, fontWeight: '700' }, input: { padding: 14, borderRadius: 10 },
  emptyState: { alignItems: 'center', borderRadius: 18, padding: 20, gap: 7 }, emptyTitle: { fontSize: 14, fontWeight: '700', textAlign: 'center' }, emptyText: { fontSize: 12, lineHeight: 19, textAlign: 'center' },
  booking: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 }, bookingHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, avatar: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
