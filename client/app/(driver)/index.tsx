import { useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Label } from '@/src/components/ui/Screen';
import DriverBookingRequest from '@/src/components/DriverBookingRequest';
import RouteMap from '@/src/components/map/ExpandableRouteMap';
import type { MapStop } from '@/src/components/map/RouteMap';
import { useTheme } from '@/src/store/theme';
import { useInterfaceText } from '@/src/i18n/useInterfaceText';
import { getDriverProfile, setDriverAvailability } from '@/src/ride/driver.service';
import { getRides, changeRideStatus, isActiveRide } from '@/src/ride/ride.store';
import { usePolling } from '@/src/ride/usePolling';
import { ROUTES, getRoute, getServiceStops, getServiceMapStops, getRoadWaypoints, isRouteMapEnabled, getTerminalMapStops, getTownName } from '@/src/data/sakay';
import { showError } from '@/src/utils/toast';

export default function DriverDashboard() {
  const { colors, isDark, brand } = useTheme();
  const translate = useInterfaceText();
  const { height } = useWindowDimensions();
  const [showSettings, setShowSettings] = useState(false);
  const closeSettings = () => { Keyboard.dismiss(); setShowSettings(false); };
  const { data, error, loading, refresh, setData } = usePolling(async () => {
    const [driver, rides] = await Promise.all([getDriverProfile(), getRides()]);
    if (rides.some(ride => ride.status === 'pending')) setShowSettings(false);
    return { driver, rides };
  }, null as { driver: Awaited<ReturnType<typeof getDriverProfile>>; rides: Awaited<ReturnType<typeof getRides>> } | null, 3000);
  const [routeId, setRouteId] = useState('');
  const [capacity, setCapacity] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showStops, setShowStops] = useState(false);
  const [recenterKey, setRecenterKey] = useState(0);
  const driver = data?.driver;
  const routes = ROUTES.filter(route => route.type === (driver?.vehicleType === 'bus' ? 'bus' : 'jeep'));
  const active = data?.rides.filter(isActiveRide) || [];
  const locked = !!driver?.isAvailable || active.length > 0;
  const chosen = locked ? driver?.routeId || active[0]?.routeId || '' : routeId || driver?.routeId || routes[0]?.id || '';
  const defaultCapacity = driver?.capacity || (driver?.vehicleType === 'bus' ? 45 : 16);
  const seats = locked ? String(defaultCapacity) : capacity ?? String(defaultCapacity);
  const pending = active.filter(ride => ride.status === 'pending').sort((a, b) => a.createdAt - b.createdAt);
  const request = pending[0];
  const accepted = active.filter(ride => ride.status !== 'pending');
  const selectedRide = request || accepted[0];
  const mapRoute = driver ? getRoute(chosen) : undefined;
  const serviceStops = isRouteMapEnabled(mapRoute) ? getServiceStops(mapRoute) : [];
  const routingWaypoints = getRoadWaypoints(mapRoute);
  const stops: MapStop[] = [...getTerminalMapStops(mapRoute), ...getServiceMapStops(mapRoute)];
  if (selectedRide?.pickupLocation) stops.unshift({ label: translate('Passenger GPS pickup'), coord: selectedRide.pickupLocation, isLivePickup: true, isOrigin: true, isDestination: false });
  const direction = mapRoute ? `${getTownName(mapRoute.originId)} → ${getTownName(mapRoute.destinationId)}` : translate('Choose a route');
  const location = driver?.location || selectedRide?.driverLocation;
  const driverLocation = location && (driver?.isAvailable || active.length > 0)
    && Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90
    && Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180 ? location : null;

  const act = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); }
    catch (e) { showError(e instanceof Error ? e.message : translate('Request failed')); }
    finally { await refresh(); setBusy(false); }
  };
  const toggleAvailability = () => {
    if (!driver || busy || error) return;
    const vehicleCapacity = locked ? defaultCapacity : Number(seats);
    if (!driver.isAvailable && (!mapRoute || !Number.isInteger(vehicleCapacity) || vehicleCapacity < 1 || vehicleCapacity > (driver.vehicleType === 'bus' ? 80 : 30))) {
      setShowSettings(true); showError(translate('Enter a valid route and vehicle capacity.')); return;
    }
    void act(() => setDriverAvailability(!driver.isAvailable, chosen, vehicleCapacity));
  };
  const online = !!driver?.isAvailable;
  const selectDirection = (nextRouteId: string) => {
    if (!driver || busy || error || active.length || nextRouteId === chosen) return;
    if (!online) { setRouteId(nextRouteId); return; }
    void act(async () => {
      const updated = await setDriverAvailability(true, nextRouteId, defaultCapacity);
      setData(current => current ? { ...current, driver: { ...current.driver, ...updated } } : current);
      setRouteId(nextRouteId);
    });
  };
  const availabilityColor = online ? '#B42318' : '#15803D';

  const availableSeats = driver?.availableSeats ?? Math.max(0, defaultCapacity - (driver?.reservedSeats || 0));
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
    <View testID="driver-map-dashboard" style={styles.dashboard}>
      <View testID="driver-home-map" style={StyleSheet.absoluteFill}><RouteMap showRouteDetails={isRouteMapEnabled(mapRoute || undefined)} vehicleType={driver?.vehicleType === 'bus' ? 'bus' : 'jeep'} key={request?.id || 'driver-map'} driverMode showFullscreen={false} renderControls={layersButton => !request && <View style={[[styles.bottomLayer, { bottom: accepted.length ? 82 : 12 }], { pointerEvents: 'box-none' }]}><View style={styles.mapTools}>{layersButton}<TouchableOpacity accessibilityRole="button" accessibilityLabel={translate(driverLocation ? 'Center map on my location' : 'Fit route on map')} onPress={() => setRecenterKey(value => value + 1)} style={[styles.iconButton, { backgroundColor: colors.card, borderColor: colors.border }]}><Ionicons name="locate-outline" size={23} color={colors.primaryLight} /></TouchableOpacity></View></View>} stops={stops} routingWaypoints={routingWaypoints} servicePath={mapRoute?.servicePath?.source ? mapRoute.servicePath.points : []} isDark={isDark} driverLocation={driverLocation} recenterKey={recenterKey} /></View>
      <View style={[styles.topControls, { pointerEvents: 'box-none' }]}>
        <View style={styles.topRow}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate(online ? 'Go offline' : 'Go online')} accessibilityState={{ disabled: !driver || busy || !!error, busy }} disabled={!driver || busy || !!error} onPress={toggleAvailability} style={[styles.onlineControl, { backgroundColor: availabilityColor, borderColor: availabilityColor, opacity: !driver || busy || !!error ? 0.65 : 1 }]}>{busy || loading ? <ActivityIndicator size="small" color={'#FFFFFF'} /> : <Ionicons name="power" size={19} color={'#FFFFFF'} />}<View style={styles.grow}><Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 14, lineHeight: 20, fontWeight: '800' }}>{translate(online ? 'Go offline' : 'Go online')}</Text><Text numberOfLines={2} style={{ color: '#FFFFFF', fontSize: 10, lineHeight: 14, marginTop: 2 }}>{translate(online ? 'ONLINE · accepting bookings' : 'OFFLINE')}</Text></View></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate('Notifications')} onPress={() => router.push('/notifications-list')} style={[styles.iconButton, styles.notificationButton, { backgroundColor: colors.card, borderColor: colors.border }]}><Ionicons name="notifications-outline" size={22} color={colors.text} /></TouchableOpacity>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate('Route and vehicle capacity')} accessibilityState={{ disabled: !driver || !!request }} disabled={!driver || !!request} onPress={() => setShowSettings(true)} style={[styles.routeControl, { backgroundColor: colors.card, borderColor: colors.border }]}><Ionicons name="return-down-forward-outline" size={19} color={colors.primaryLight} /><View style={styles.grow}><Text numberOfLines={2} style={{ color: colors.text, fontSize: 13, lineHeight: 19, fontWeight: '700' }}>{direction}</Text><Text style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 3 }}>{driver?.plateNo || '—'} · {driver ? translate('{{count}} seats available', { count: availableSeats }) : translate('Checking available seats…')}</Text></View><Ionicons name="options-outline" size={19} color={colors.primaryLight} /></TouchableOpacity>
        {!!error && <View style={[styles.errorBanner, { backgroundColor: colors.coralSurface }]}><Ionicons name="cloud-offline-outline" size={19} color={colors.error} /><Text style={{ color: colors.error, flex: 1, fontSize: 11, lineHeight: 17 }}>{error}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={translate('Retry')} onPress={refresh} style={styles.retry}><Text style={{ color: colors.error, fontSize: 12, fontWeight: '700' }}>{translate('Retry')}</Text></TouchableOpacity></View>}
      </View>
      {!!request && <View style={[styles.bottomLayer, { pointerEvents: 'box-none' }]}><DriverBookingRequest ride={request} count={pending.length} maxHeight={Math.min(510, height * 0.68)} busy={busy} disabled={busy || !!error} onRespond={status => { void act(() => changeRideStatus(request.id, status)); }} /></View>}
      {!request && accepted.length > 0 && <View style={[styles.bottomLayer, { pointerEvents: 'box-none' }]}><TouchableOpacity accessibilityRole="button" accessibilityLabel={translate('View active trips')} onPress={() => router.navigate('/(driver)/driver-trips')} style={[styles.activeTrip, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={[styles.tripIcon, { backgroundColor: colors.mintSurface }]}><Ionicons name="navigate-outline" size={21} color={colors.primaryLight} /></View><View style={styles.grow}><Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{translate('{{count}} active trip(s)', { count: accepted.length })}</Text><Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 3 }}>{translate('Continue your bookings in Trips')}</Text></View><Ionicons name="chevron-forward" size={19} color={colors.primaryLight} /></TouchableOpacity></View>}
    </View>

    <Modal visible={showSettings} transparent animationType="slide" onRequestClose={closeSettings}>
      <View style={styles.modalBackdrop}><Pressable accessibilityLabel={translate('Close route settings')} onPress={closeSettings} style={StyleSheet.absoluteFill} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetKeyboard}>
          <SafeAreaView edges={['bottom']} style={[styles.sheet, { maxHeight: height * 0.9, backgroundColor: colors.card }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <View style={styles.sheetHeading}><View style={styles.grow}><Text style={[styles.sectionTitle, { color: colors.text }]}>{translate('Route & capacity')}</Text><Text style={[styles.caption, { color: colors.textSecondary, marginTop: 5 }]}>{driver?.plateNo} · {translate(driver?.vehicleType === 'bus' ? 'Bus' : 'Jeepney')}</Text></View><Pressable testID="close-route-settings" accessibilityRole="button" accessibilityLabel={translate('Close route settings')} hitSlop={12} onPress={closeSettings} style={({ pressed }) => [styles.iconButton, styles.closeSettingsButton, { backgroundColor: colors.backgroundAlt, borderColor: colors.border, opacity: pressed ? 0.65 : 1 }]}><View style={{ pointerEvents: 'none' }}><Ionicons name="close" size={22} color={colors.text} /></View></Pressable></View>
            <ScrollView style={{ flexShrink: 1, minHeight: 0 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={{ gap: 14 }}>
              <View style={styles.stats}>{[{ label: 'On board', count: driver?.occupiedSeats || 0 }, { label: 'Waiting', count: driver?.waitingSeats || 0 }, { label: 'Available', count: availableSeats }].map(stat => <View key={stat.label} style={[styles.stat, { backgroundColor: colors.backgroundAlt }]}><Text style={{ color: colors.text, fontSize: 21, fontWeight: '800' }}>{stat.count}</Text><Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 4 }}>{translate(stat.label)}</Text></View>)}</View>
              <Text style={[styles.caption, { color: colors.textSecondary }]}>{translate('Choose the direction you are serving')}</Text>
              <View style={{ gap: 8 }}>{routes.map(route => <TouchableOpacity key={route.id} accessibilityRole="button" accessibilityLabel={getTownName(route.originId) + ' → ' + getTownName(route.destinationId)} accessibilityState={{ selected: chosen === route.id, disabled: !driver || busy || !!error || active.length > 0 }} disabled={!driver || busy || !!error || active.length > 0} onPress={() => selectDirection(route.id)} style={[styles.routeOption, { backgroundColor: chosen === route.id ? colors.mintSurface : colors.card, borderColor: chosen === route.id ? colors.borderFocused : colors.borderLight }]}><Ionicons name="return-down-forward-outline" size={20} color={colors.primaryLight} /><Text style={[styles.grow, { color: colors.text, fontSize: 14, lineHeight: 21, fontWeight: '600' }]}>{getTownName(route.originId)} → {getTownName(route.destinationId)}</Text><Ionicons name={chosen === route.id ? 'checkmark-circle' : 'ellipse-outline'} size={19} color={chosen === route.id ? colors.primaryLight : colors.textTertiary} /></TouchableOpacity>)}</View>
              <View style={styles.capacityRow}><Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 }}>{translate('Total vehicle capacity')}</Text><TextInput accessibilityLabel={translate('Vehicle seat capacity')} value={seats} onChangeText={setCapacity} editable={!busy && !locked} keyboardType="number-pad" style={[styles.capacityInput, { color: colors.text, backgroundColor: colors.backgroundAlt, borderColor: colors.border }]} /></View>
              <Text style={[styles.caption, { color: colors.textSecondary }]}>{translate(active.length ? 'Finish existing bookings before changing your route or capacity.' : online ? 'Choose another direction to update your route. Go offline to change capacity.' : 'Your selected route and capacity are applied when you go online.')}</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate('Route stops')} accessibilityState={{ expanded: showStops }} onPress={() => setShowStops(value => !value)} style={styles.sectionLink}><View style={styles.inline}><Ionicons name="location-outline" size={20} color={colors.primaryLight} /><Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{translate('Route stops')}</Text></View><Ionicons name={showStops ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} /></TouchableOpacity>
              {showStops && <View style={{ gap: 12 }}>{serviceStops.length ? serviceStops.map((stop, index) => <View key={stop.id} style={styles.inline}><Text style={{ color: colors.primaryLight, fontWeight: '700' }}>{index + 1}</Text><View style={styles.grow}><Label strong>{stop.name}</Label><Label>{translate(stop.townId ? stop.townId === mapRoute?.originId ? 'Departure' : stop.townId === mapRoute?.destinationId ? 'End of route' : 'Boarding / alighting' : index === 0 ? 'Departure' : index === serviceStops.length - 1 ? 'End of route' : 'Boarding / alighting')}</Label></View></View>) : <Label>{translate(isRouteMapEnabled(mapRoute) ? 'Exact boarding stops and the service path are not yet verified for this route.' : 'Route lines and drop-off points are not available for this route yet.')}</Label>}<Label>{translate('Finish this direction before choosing a separate return route. Completing a passenger booking does not reverse your route.')}</Label></View>}
            </ScrollView>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate('Done')} onPress={closeSettings} style={[styles.doneButton, { backgroundColor: colors.primary }]}><Text style={{ color: colors.onPrimary, fontSize: 15, fontWeight: '700' }}>{translate('Done')}</Text><Ionicons name="checkmark" size={20} color={brand.sunshine} /></TouchableOpacity>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  dashboard: { flex: 1, overflow: 'hidden' }, grow: { flex: 1, minWidth: 0 }, topControls: { position: 'absolute', top: 12, left: 12, right: 12, maxWidth: 560, gap: 10 }, topRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10 }, onlineControl: { flex: 1, minWidth: 0, minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, paddingVertical: 8, borderWidth: 1, borderRadius: 17, boxShadow: '0 2px 9px rgba(0,0,0,0.1)' }, notificationButton: { width: 54, height: 54, borderRadius: 17, flexShrink: 0 }, iconButton: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }, routeControl: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderRadius: 16, boxShadow: '0 2px 9px rgba(0,0,0,0.08)' },
  bottomLayer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingBottom: 12, alignItems: 'center' }, mapTools: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }, activeTrip: { width: '100%', maxWidth: 600, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 18, padding: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }, tripIcon: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 9, borderRadius: 14 }, retry: { minHeight: 44, paddingHorizontal: 5, justifyContent: 'center' }, sectionTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.4 }, caption: { fontSize: 12, lineHeight: 19 }, inline: { flexDirection: 'row', alignItems: 'center', gap: 9 }, stats: { flexDirection: 'row', gap: 8 }, stat: { flex: 1, minWidth: 0, borderRadius: 15, padding: 11 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }, sheetKeyboard: { width: '100%', maxWidth: 600, alignSelf: 'center' }, sheet: { padding: 20, borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: 14 }, handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center' }, sheetHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 0, zIndex: 2 }, closeSettingsButton: { flexShrink: 0, zIndex: 3, minWidth: 48, minHeight: 48 }, routeOption: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 15, borderWidth: 1, minHeight: 58 }, capacityRow: { flexDirection: 'row', alignItems: 'center', gap: 15 }, capacityInput: { width: 82, minHeight: 48, borderRadius: 13, borderWidth: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', padding: 10 }, doneButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 52, borderRadius: 16, padding: 14 }, sectionLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 48 },
});
