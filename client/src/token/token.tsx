import { useState } from 'react';
import { Screen, Card, Label, Action, Loading } from '@/src/components/ui/Screen';
import { apiRequest } from '@/src/config/api';
import { usePolling } from '@/src/ride/usePolling';
import { showError, showSuccess } from '@/src/utils/toast';
interface Rewards { balance: { tokens: number; lifetime: number }; daily: { claimedToday: boolean; nextDay: number | null }; tasks: { rides?: boolean; rate?: boolean; counts: { rides: number; rate: number } }; history: { _id: string; amount: number; reason: string; createdAt: string }[]; }
export default function TokenScreen() {
 const { data, error, loading, refresh } = usePolling(async () => {
  const [balance, daily, tasks, history] = await Promise.all([apiRequest('/tokens/balance'),apiRequest('/tokens/daily-claims'),apiRequest('/tokens/completed-tasks'),apiRequest('/tokens/history')]);
  return { balance, daily, tasks, history: history.history } as Rewards;
 }, null as Rewards | null);
 const [busy, setBusy] = useState(false);
 const claim = async (path: string, body: object) => { if (busy) return; setBusy(true); try { await apiRequest(path, { method: 'POST', body: JSON.stringify(body) }); await refresh(); showSuccess('Reward claimed'); } catch(e) { showError(e instanceof Error ? e.message : 'Unable to claim'); } finally { setBusy(false); } };
 const dailyRewards = [0.1,0.2,0.3,0.4,0.5,0.6,1];
 return <Screen title="SakayNE tokens" back>{loading && <Loading />}{!!error && <Card><Label>{error}</Label><Action title="Retry" onPress={refresh} /></Card>}
 {data && <><Card><Label strong>{data.balance.tokens.toFixed(2)} tokens</Label><Label>Lifetime earned: {data.balance.lifetime.toFixed(2)}</Label><Label>Collect rewards for daily check-ins and completed bookings.</Label></Card>
 <Card><Label strong>Daily check-in</Label><Label>7-day rewards: 0.10 · 0.20 · 0.30 · 0.40 · 0.50 · 0.60 · 1.00</Label><Label>Check in daily to keep your streak. The cycle starts again after Day 7. Resets follow Philippine time.</Label>
 <Action disabled={busy || data.daily.claimedToday} title={data.daily.claimedToday ? 'Claimed today' : 'Claim Day ' + ((data.daily.nextDay ?? 0) + 1) + ' · +' + dailyRewards[data.daily.nextDay ?? 0].toFixed(2)} onPress={() => { void claim('/tokens/claim-daily', { day: data.daily.nextDay }); }} /></Card>
 {(['rides','rate'] as const).map(task => <Card key={task}><Label strong>{task === 'rides' ? 'Complete 10 rides' : 'Rate 10 drivers'}</Label><Label>{Math.min(10,data.tasks.counts[task])} / 10 · +1 token</Label><Action disabled={busy || !!data.tasks[task] || data.tasks.counts[task] < 10} title={data.tasks[task] ? 'Claimed' : 'Claim reward'} onPress={() => { void claim('/tokens/complete-task', { task }); }} /></Card>)}
 <Label strong>Recent rewards</Label>{data.history.length === 0 && <Label>No rewards yet.</Label>}{data.history.slice(0,20).map(h => <Card key={h._id}><Label>{h.reason} · +{h.amount.toFixed(2)}</Label><Label>{new Date(h.createdAt).toLocaleString('en-PH')}</Label></Card>)}</>}
 </Screen>;
}
