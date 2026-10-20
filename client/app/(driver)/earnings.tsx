import { apiRequest } from '@/src/config/api';
import { Screen, Card, Label, Action, Loading } from '@/src/components/ui/Screen';
import { usePolling } from '@/src/ride/usePolling';
export default function DriverEarningsScreen() {
 const { data, error, loading, refresh } = usePolling(() => apiRequest<{ total: number; today: number; trips: { _id: string; fare: number; seats: number; fromName: string; toName: string; completedAt: string }[] }>('/drivers/earnings'), null);
 return <Screen title="Earnings">{loading && <Loading />}{!!error && <Card><Label>{error}</Label><Action title="Retry" onPress={refresh} /></Card>}
 {data && <><Card><Label>Today · Philippine time</Label><Label strong>₱{data.today.toFixed(2)}</Label><Label>Total cash collected</Label><Label strong>₱{data.total.toFixed(2)}</Label><Label>{data.trips.length} completed bookings</Label></Card>
 {!data.trips.length && <Label>Completed rides will appear here.</Label>}
 {data.trips.map(r => <Card key={r._id}><Label strong>{r.fromName} → {r.toName}</Label><Label>₱{r.fare.toFixed(2)} · {r.seats} seat(s)</Label><Label>{new Date(r.completedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</Label></Card>)}</>}
 </Screen>;
}
