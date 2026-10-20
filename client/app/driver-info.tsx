import { Redirect, useLocalSearchParams } from 'expo-router';
export default function DriverInfoScreen() {
 const { driverId, routeId, fromId, toId } = useLocalSearchParams<{ driverId?: string; routeId?: string; fromId?: string; toId?: string }>();
 return driverId && routeId && fromId && toId ? <Redirect href={{ pathname: '/route-map', params: { driverId, routeId, fromId, toId } }} /> : <Redirect href="/(passenger)/home" />;
}
