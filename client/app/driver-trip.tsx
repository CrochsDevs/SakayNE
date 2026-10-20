import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, Card, Label, Loading } from '@/src/components/ui/Screen';
import { getRide, RideBooking } from '@/src/ride/ride.store';
import { usePolling } from '@/src/ride/usePolling';
import { getRoute, getServiceStops, getTownName } from '@/src/data/sakay';
import RouteMap from '@/src/components/map/RouteMap';
import { useTheme } from '@/src/store/theme';
export default function DriverTrip() {
 const { rideId } = useLocalSearchParams<{ rideId: string }>();
 const { data: ride, loading, error } = usePolling(() => getRide(rideId), null as RideBooking | null);
 const { isDark } = useTheme();
 const route = ride && getRoute(ride.routeId);
 const stops = getServiceStops(route || undefined).map((stop, index, all) => ({ label: `${index + 1}. ${stop.name}`, coord: { latitude: stop.lat, longitude: stop.lng }, isOrigin: index === 0, isDestination: index === all.length - 1 }));
 return <Screen title="Passenger trip" back>{loading && <Loading />}{!!error && <Label>{error}</Label>}{ride && <>
   <Card><Label strong>{ride.passengerName} · {ride.seats} seat(s)</Label><Label>{ride.fromName} → {ride.toName}</Label><Label>{ride.status.toUpperCase()} · ₱{ride.fare}</Label></Card>
   {route && <Card><Label strong>One-way {route.type === 'bus' ? 'bus' : 'jeepney'} route</Label><Label>{getTownName(route.originId)} → {getTownName(route.destinationId)}</Label><Label>Continue along the service route after this passenger alights.</Label></Card>}
   <View style={{ height: 400, borderRadius: 18, overflow: 'hidden' }}><RouteMap stops={stops} servicePath={route && route.servicePath?.source ? route.servicePath.points : []} isDark={isDark} driverLocation={ride.driverLocation} /></View>
   {!stops.length && <Label>Exact boarding stops and the service path are awaiting verification. Town centers are not shown as pickup stops.</Label>}
   <Label>Use your Trips tab to confirm boarding, verify the passenger code and confirm cash after alighting.</Label>
 </>}</Screen>;
}
