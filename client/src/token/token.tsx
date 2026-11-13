import { useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/store/theme';
import { Screen, Card, Label, Action, Loading } from '@/src/components/ui/Screen';
import { apiRequest } from '@/src/config/api';
import { usePolling } from '@/src/ride/usePolling';
import { showError, showSuccess } from '@/src/utils/toast';
interface Rewards { balance: { tokens: number; lifetime: number }; daily: { claimedToday: boolean; nextDay: number | null }; tasks: { rides?: boolean; rate?: boolean; counts: { rides: number; rate: number } }; history: { _id: string; amount: number; reason: string; createdAt: string }[]; }
export default function TokenScreen() {
 const { colors } = useTheme();
 const { data, error, loading, refresh } = usePolling(async () => {
  const [balance, daily, tasks, history] = await Promise.all([apiRequest('/tokens/balance'),apiRequest('/tokens/daily-claims'),apiRequest('/tokens/completed-tasks'),apiRequest('/tokens/history')]);
  return { balance, daily, tasks, history: history.history } as Rewards;
 }, null as Rewards | null);
 const [busy, setBusy] = useState(false);
 const claim = async (path: string, body: object) => { if (busy) return; setBusy(true); try { await apiRequest(path, { method: 'POST', body: JSON.stringify(body) }); await refresh(); showSuccess('Reward claimed'); } catch(e) { showError(e instanceof Error ? e.message : 'Unable to claim'); } finally { setBusy(false); } };
 const dailyRewards = [0.1,0.2,0.3,0.4,0.5,0.6,1];
 return <Screen title="Sakay tokens" back>{loading && <Loading />}{!!error && <Card><Label>{error}</Label><Action title="Retry" onPress={refresh} /></Card>}
 {data && <><View style={{ backgroundColor: colors.heroStart, padding: 24, borderRadius: 26, gap: 10 }}>
 <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: colors.heroText, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>A LITTLE EXTRA FOR YOU</Text><Ionicons name="sparkles" size={23} color={colors.heroText} /></View>
 <Text style={{ color: colors.heroText, fontSize: 46, fontWeight: '900', letterSpacing: -2 }}>{data.balance.tokens.toFixed(2)}<Text style={{ fontSize: 16, letterSpacing: 0 }}> tokens</Text></Text>
 <Text style={{ color: colors.heroSubtext, fontSize: 13 }}>Lifetime earned: {data.balance.lifetime.toFixed(2)}</Text>
 </View><Label>Good rides, little rewards. Check in daily and collect tokens as you go.</Label>
 <Card><Label strong>Daily check-in</Label><Label>7-day rewards: 0.10 · 0.20 · 0.30 · 0.40 · 0.50 · 0.60 · 1.00</Label><Label>Check in daily to keep your streak. The cycle starts again after Day 7. Resets follow Philippine time.</Label>
 <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{dailyRewards.map((amount, index) => <View key={index} style={{ minWidth: 55, flexGrow: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6, borderRadius: 14, backgroundColor: data.daily.nextDay === index ? colors.accentSurface : colors.mintSurface }}><Text style={{ color: colors.textSecondary, fontSize: 10 }}>Day {index + 1}</Text><Text style={{ color: colors.text, fontWeight: '800', fontSize: 14, marginTop: 5 }}>+{amount.toFixed(1)}</Text></View>)}</View>
 <Action disabled={busy || data.daily.claimedToday} title={data.daily.claimedToday ? 'Claimed today' : 'Claim Day ' + ((data.daily.nextDay ?? 0) + 1) + ' · +' + dailyRewards[data.daily.nextDay ?? 0].toFixed(2)} onPress={() => { void claim('/tokens/claim-daily', { day: data.daily.nextDay }); }} /></Card>
 {(['rides','rate'] as const).map(task => <Card key={task}><Label strong>{task === 'rides' ? 'Complete 10 rides' : 'Rate 10 drivers'}</Label><Label>{Math.min(10,data.tasks.counts[task])} / 10 · +1 token</Label><Action disabled={busy || !!data.tasks[task] || data.tasks.counts[task] < 10} title={data.tasks[task] ? 'Claimed' : 'Claim reward'} onPress={() => { void claim('/tokens/complete-task', { task }); }} /></Card>)}
 <Label strong>Recent rewards</Label>{data.history.length === 0 && <Label>No rewards yet.</Label>}{data.history.slice(0,20).map(h => <Card key={h._id}><Label>{h.reason} · +{h.amount.toFixed(2)}</Label><Label>{new Date(h.createdAt).toLocaleString('en-PH')}</Label></Card>)}</>}
 </Screen>;
}
