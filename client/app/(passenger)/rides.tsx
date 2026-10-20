import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Screen, Card, Label, Action, Loading } from '@/src/components/ui/Screen';
import { getRides, RideBooking, isActiveRide } from '@/src/ride/ride.store';
import { usePolling } from '@/src/ride/usePolling';
export default function RidesScreen() {
 const { data: rides, loading, error, refresh } = usePolling(getRides, [] as RideBooking[]);
 const [filter, setFilter] = useState('all');
 const filtered = rides.filter(r => filter === 'all' || (filter === 'active' ? isActiveRide(r) : r.status === filter));
 return <Screen title="My rides">
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{['all','active','completed','cancelled'].map(f => <Action key={f} title={f} secondary={filter !== f} onPress={() => setFilter(f)} />)}</View>
  {loading && <Loading />}{!!error && <Card><Label>{error}</Label><Action title="Retry" onPress={refresh} /></Card>}
  {!loading && !error && !filtered.length && <Label>No rides yet. Your bookings will appear here.</Label>}
  {filtered.map(ride => <Card key={ride.id}><Label strong>{ride.fromName} → {ride.toName}</Label><Label>{ride.status.toUpperCase()} · {ride.type === 'bus' ? 'Bus' : 'Jeepney'} · {ride.seats} seat(s)</Label><Label>{new Date(ride.createdAt).toLocaleString('en-PH')} · ₱{ride.fare}</Label><Label>{ride.driverName} · {ride.vehicle}</Label><Action secondary title="Booking details" onPress={() => router.push({ pathname: '/ride-tracking', params: { rideId: ride.id } })} /></Card>)}
 </Screen>;
}
