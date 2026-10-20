import { useRef, useState } from 'react';
import { View, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, Card, Label, Action, Loading } from '@/src/components/ui/Screen';
import RouteMap from '@/src/components/map/RouteMap';
import { useTheme } from '@/src/store/theme';
import { getActiveRide, getRide, changeRideStatus, rateRide, RideBooking, isActiveRide, setSeatDetection } from '@/src/ride/ride.store';
import { usePolling } from '@/src/ride/usePolling';
import { getRoute, getTown, buildSegment } from '@/src/data/sakay';
import { showError } from '@/src/utils/toast';
const messages = { pending: 'Waiting for your driver to accept', accepted: 'Driver accepted. Head to your pickup stop.', arrived: 'Driver is at pickup. Show your boarding code.', ongoing: 'You are on board. Enjoy your trip!', completed: 'Trip completed. Thank you for riding.', cancelled: 'This booking was cancelled.' };
const geoMessages: Record<string, string> = { disabled: 'Automatic detection is off.', waiting_for_acceptance: 'Waiting for driver acceptance.', waiting_for_fresh_gps: 'Waiting for fresh GPS from both phones.', poor_accuracy: 'GPS is not precise enough. Keep location enabled or use your boarding code.', waiting_for_proximity: 'Waiting until you are near your assigned driver.', boarding_candidate: 'Confirming that you have boarded…', alighting_candidate: 'Confirming that you have moved at least 15 meters away…', onboard: 'Boarding detected. Your seats are occupied.', alighted: 'Alighting detected. Your seats are available again.' };
export default function RideTrackingScreen() {
 const { rideId } = useLocalSearchParams<{ rideId?: string }>();
 const pinnedId = useRef(rideId);
 if (rideId) pinnedId.current = rideId;
 const { isDark } = useTheme();
 const { data: ride, loading, error, refresh } = usePolling(async () => {
   const result = pinnedId.current ? await getRide(pinnedId.current) : await getActiveRide();
   if (result) pinnedId.current = result.id;
   return result;
 }, null as RideBooking | null);
 const [busy, setBusy] = useState(false);
 const route = ride ? getRoute(ride.routeId) : null;
 const segment = ride && route ? buildSegment(route, ride.fromId, ride.toId) : [];
 const stops = segment.flatMap((s, i) => { const town = getTown(s.townId); return town ? [{ label: town.name, coord: { latitude: town.lat, longitude: town.lng }, isOrigin: i === 0, isDestination: i === segment.length - 1 }] : []; });
 const location = ride?.driverLocation;
 const fresh = !!location && Date.now() - new Date(location.updatedAt).getTime() < 60000;
 const act = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); await refresh(); } catch(e) { showError(e instanceof Error ? e.message : 'Unable to update ride'); } finally { setBusy(false); } };
 return <Screen title="Your booking" back>
  {loading && <Loading />}
  {!!error && <Card><Label>{error}</Label><Action title="Retry" onPress={refresh} /></Card>}
  {!loading && !ride && !error && <Card><Label>No active booking</Label><Action title="Find a ride" onPress={() => router.replace('/(passenger)/home')} /></Card>}
  {ride && <>
   <Card><Label strong>{ride.fromName} → {ride.toName}</Label><Label>{ride.status === 'ongoing' && ride.occupancyStatus === 'alighted' ? 'You have alighted. Your seats were released. Settle cash with your driver.' : messages[ride.status]}</Label><Label>{ride.type === 'bus' ? 'Bus' : 'Jeepney'} · {ride.seats} seat(s) · {ride.status.toUpperCase()}</Label></Card>
   {ride.status === 'pending' && <Label>The driver has up to 5 minutes to confirm. You can cancel while waiting.</Label>}
   {ride.status === 'cancelled' && ride.cancellationReason && <Label>{ride.cancellationReason}</Label>}
   <View style={{ height: 300, borderRadius: 18, overflow: 'hidden' }}><RouteMap stops={stops} servicePath={route?.servicePath?.source ? route.servicePath.points : []} isDark={isDark} driverLocation={isActiveRide(ride) ? location : null} /></View>
   <Label>{isActiveRide(ride) ? fresh ? 'Driver GPS updated ' + new Date(location!.updatedAt).toLocaleTimeString('en-PH') : location ? 'Driver location is outdated. Waiting for a fresh GPS update.' : 'Waiting for driver GPS. Route preview is shown.' : 'Route preview'}</Label>
   {isActiveRide(ride) && <Card><Label strong>Automatic seat detection</Label>
    <Label>{ride.occupancyStatus === 'alighted' ? 'Alighting detected. Your seats are available again.' : geoMessages[ride.geoDetection?.state || 'disabled'] || 'Waiting for GPS…'}</Label>
    <Label>Share your location with your assigned driver while this booking is active. Boarding needs several close GPS readings; alighting needs at least 15 meters of separation after allowing for GPS accuracy.</Label>
    <Label>Keep both apps open. The boarding code remains available when GPS is inaccurate.</Label>
    {ride.geoDetection?.samples && ride.occupancyStatus !== 'alighted' && <Label>Confirming GPS readings: {Math.min(3, ride.geoDetection.samples)} / 3</Label>}
    {ride.occupancyStatus !== 'alighted' && <Action title={ride.geoTrackingEnabled ? 'Disable automatic seat detection' : 'Enable automatic seat detection'} disabled={busy} onPress={() => { void act(() => setSeatDetection(ride.id, !ride.geoTrackingEnabled)); }} />}
   </Card>}
   <Card><Label strong>{ride.driverName} · {ride.vehicle}</Label><Label>Pickup: {ride.fromName}</Label><Label>Drop-off: {ride.toName}</Label><Label>Planning travel time: ~{ride.minutes} min</Label>
    {ride.driverPhone && isActiveRide(ride) && <Action secondary title="Call driver" onPress={() => { void Linking.openURL('tel:' + ride.driverPhone).catch(() => showError('Unable to open dialer')); }} />}
   </Card>
   {isActiveRide(ride) && <Action title="Message driver" secondary onPress={() => router.push({ pathname: '/ride-chat', params: { rideId: ride.id } })} />}
   {['pending', 'accepted', 'arrived'].includes(ride.status) && <Card><Label>Show this code to your driver when boarding</Label><Label strong>{ride.boardingCode}</Label></Card>}
   <Card><Label strong>₱{ride.fare.toFixed(2)} · Cash</Label><Label>₱{ride.unitFare} × {ride.seats} seat(s) · {ride.paymentStatus === 'paid' ? 'Driver marked cash collected' : 'Pay your driver at the end of the ride'}</Label></Card>
   {['pending', 'accepted', 'arrived'].includes(ride.status) && <Action disabled={busy} secondary title="Cancel booking" onPress={() => { void act(() => changeRideStatus(ride.id, 'cancelled')); }} />}
   {ride.status === 'completed' && !ride.rating && <Card><Label strong>Rate your driver</Label><View style={{ flexDirection: 'row', gap: 8 }}>{[1,2,3,4,5].map(r => <View key={r} style={{ flex: 1 }}><Action disabled={busy} title={String(r) + '★'} onPress={() => { void act(() => rateRide(ride.id, r)); }} /></View>)}</View></Card>}
   {ride.rating && <Label>Your rating: {ride.rating} / 5</Label>}
   {!isActiveRide(ride) && <Action title="Book another ride" onPress={() => router.replace('/(passenger)/home')} />}
  </>}
 </Screen>;
}
