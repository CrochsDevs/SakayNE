import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, Card, Label, Loading } from '@/src/components/ui/Screen';
import { getRide, RideBooking } from '@/src/ride/ride.store';
import { usePolling } from '@/src/ride/usePolling';
import { getRoute, getServiceStops, getServiceMapStops, getRoadWaypoints, isRouteMapEnabled, getTerminalMapStops, getTownName } from '@/src/data/sakay';
import RouteMap from '@/src/components/map/ExpandableRouteMap';
import type { MapStop } from '@/src/components/map/RouteMap';
import { useTheme } from '@/src/store/theme';
import { useInterfaceText } from '@/src/i18n/useInterfaceText';
import PickupAccuracyNotice from '@/src/components/PickupAccuracyNotice';
import TravelTimeEstimate from '@/src/components/TravelTimeEstimate';
export default function DriverTrip() {
 const { rideId } = useLocalSearchParams<{ rideId: string }>();
 const { data: ride, loading, error } = usePolling(() => getRide(rideId), null as RideBooking | null);
 const { isDark } = useTheme();
 const translate = useInterfaceText();
 const route = ride && getRoute(ride.routeId);
 const stops: MapStop[] = [...getTerminalMapStops(route || undefined, ride?.fromId, ride?.toId), ...getServiceMapStops(route || undefined, ride?.fromId, ride?.toId)];
 if (ride?.pickupLocation) stops.unshift({ label: translate('Passenger GPS pickup'), coord: ride.pickupLocation, isLivePickup: true, isOrigin: true, isDestination: false });
 const routingWaypoints = getRoadWaypoints(route || undefined, ride?.fromId, ride?.toId, ride?.pickupLocation);
 return <Screen title="Passenger trip" back>{loading && <Loading />}{!!error && <Label>{error}</Label>}{ride && <>
   <TravelTimeEstimate minutes={ride.minutes} historical={['completed', 'cancelled'].includes(ride.status)} />
   <Card><Label strong>{ride.passengerName} · {ride.seats} seat(s)</Label><Label>{ride.fromName} → {ride.toName}</Label><Label>{ride.status.toUpperCase()}</Label></Card>
   {ride.pickupLocation && <Card><Label strong>{translate('Passenger GPS pickup')}</Label><Label>{translate('Pickup area: {{name}}', { name: ride.fromName })}</Label><Label>{ride.pickupLocation.latitude.toFixed(6)}, {ride.pickupLocation.longitude.toFixed(6)}</Label></Card>}
   {ride.pickupLocation && <PickupAccuracyNotice accuracy={ride.pickupLocation.accuracy} forDriver />}
   {route && <Card><Label strong>One-way {route.type === 'bus' ? 'bus' : 'jeepney'} route</Label><Label>{getTownName(route.originId)} → {getTownName(route.destinationId)}</Label><Label>Continue along the service route after this passenger alights.</Label></Card>}
   <View style={{ height: 400, borderRadius: 18, overflow: 'hidden' }}><RouteMap showRouteDetails={isRouteMapEnabled(route || undefined)} vehicleType={route ? route.type : undefined} stops={stops} routingWaypoints={routingWaypoints} servicePath={route && route.servicePath?.source ? route.servicePath.points : []} isDark={isDark} driverLocation={ride.driverLocation} /></View>
   {!isRouteMapEnabled(route || undefined) ? <Label>{translate('Route lines and drop-off points are not available for this route yet.')}</Label> : !getServiceStops(route || undefined).length && <Label>Exact service stops and the service path are awaiting verification. Any GPS pickup pin shown belongs to this booking.</Label>}
   <Label>Use your Trips tab to confirm boarding, verify the passenger code and complete the trip after alighting.</Label>
 </>}</Screen>;
}
