import { useState } from 'react';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import { Screen, Card, Label, Action, Loading } from '@/src/components/ui/Screen';
import { apiRequest } from '@/src/config/api';
import { logout } from '@/src/auth/auth.service';
import { usePolling } from '@/src/ride/usePolling';
import { showError } from '@/src/utils/toast';
interface Application { _id: string; fullName: string; email: string; phone: string; vehicleType: string; plateNo: string; licenseNo: string; approvalStatus: string; application?: Record<string, string>; documents?: Record<string, string>; }
export default function AdminScreen() {
  const { data, error, loading, refresh } = usePolling(async () => (await apiRequest<{ drivers: Application[] }>('/admin/drivers')).drivers, [] as Application[]);
  const [busy, setBusy] = useState(false);
  const review = async (driver: Application, approvalStatus: string) => { setBusy(true); try { await apiRequest('/admin/drivers/' + driver._id, { method: 'PATCH', body: JSON.stringify({ approvalStatus }) }); await refresh(); } catch(e) { showError(e instanceof Error ? e.message : 'Review failed'); } finally { setBusy(false); } };
  return <Screen title="Driver applications">{loading && <Loading />}{!!error && <Card><Label>{error}</Label><Action title="Retry" onPress={refresh} /></Card>}
    {data.map(d => <Card key={d._id}><Label strong>{d.fullName}</Label><Label>{d.email} · {d.phone}</Label><Label>{d.vehicleType} · {d.plateNo}</Label><Label>License: {d.licenseNo}</Label><Label>Status: {d.approvalStatus}</Label>
      {!!d.application && Object.entries(d.application).filter(([, v]) => !!v && typeof v !== 'object').map(([k, v]) => <Label key={k}>{k}: {String(v)}</Label>)}
      {!!d.documents && Object.entries(d.documents).map(([key, url]) => <Action key={key} title={'View ' + key} secondary onPress={() => { void Linking.openURL(url).catch(() => showError('Cannot open document')); }} />)}
      <Action title="Approve driver" disabled={busy || d.approvalStatus === 'approved'} onPress={() => { void review(d, 'approved'); }} /><Action title="Reject application" secondary disabled={busy || d.approvalStatus === 'rejected'} onPress={() => { void review(d, 'rejected'); }} />
    </Card>)}
    {!loading && !data.length && <Label>No applications yet.</Label>}
    <Action title="Sign out" secondary onPress={() => { void logout().catch(() => {}).finally(() => router.replace('/(auth)/login')); }} />
  </Screen>;
}
