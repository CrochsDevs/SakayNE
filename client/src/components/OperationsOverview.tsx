import { Card, Label, Action, Loading } from './ui/Screen';
import { usePolling } from '@/src/ride/usePolling';
import { apiRequest } from '@/src/config/api';

interface Overview {
  date: string; passengers: number; drivers: number; pendingApprovals: number; onlineVehicles: number;
  catalogRoutes: number; activeBookings: number; bookingsToday: number; completedToday: number;
  cancelledToday: number; recordedCollectionsToday: number;
  recent: { _id: string; fromName?: string; toName?: string; vehicle?: string; status: string; seats?: number }[];
}
export default function OperationsOverview() {
  const { data, error, loading, refresh } = usePolling(() => apiRequest<Overview>('/admin/operations'), null as Overview | null, 15000);
  if (loading) return <Loading />;
  return <>
    {!!error && <Card><Label>Operations data may be out of date: {error}</Label><Action title="Refresh operations" onPress={refresh} /></Card>}
    {data && <>
      <Card><Label strong>Operations · {data.date} (Manila)</Label>
        <Label>{data.passengers} passengers · {data.drivers} drivers</Label>
        <Label>{data.pendingApprovals} driver applications pending</Label>
        <Label>{data.onlineVehicles} online vehicles · {data.catalogRoutes} catalog routes</Label>
        <Label strong>{data.activeBookings} active bookings</Label>
        <Label>Today: {data.bookingsToday} new · {data.completedToday} completed · {data.cancelledToday} cancelled</Label>
      </Card>
      <Card><Label strong>Recent bookings</Label>
        {!data.recent.length && <Label>No bookings yet.</Label>}
        {data.recent.map(ride => <Label key={ride._id}>{ride.fromName || 'Legacy pickup'} → {ride.toName || 'Legacy destination'} · {ride.status} · {ride.seats ?? 1} seat(s) · {ride.vehicle || 'Vehicle unavailable'}</Label>)}
      </Card>
    </>}
  </>;
}
