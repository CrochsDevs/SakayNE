import { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { showError } from '@/src/utils/toast';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '@/src/auth/auth.service';
import { getTokenHistory } from '@/src/token/token.service';

export default function TokenHistoryScreen() {
  const [history, setHistory] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const user = await getCurrentUser();
    if (user?.email) {
      try { const h = await getTokenHistory(user.email); setHistory(h); } catch(e) { showError('Unable to load rewards', e instanceof Error ? e.message : 'Retry later'); }
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load().then(() => setRefreshing(false)); }} tintColor="#087F8C" />}>
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F7F5EF', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
              <Ionicons name="arrow-back" size={20} color="#153B43" />
            </TouchableOpacity>
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#153B43' }}>Token History</Text>
          </View>

          {history.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Ionicons name="time-outline" size={48} color="#DCE8E5" />
              <Text style={{ fontSize: 14, color: '#728A8E', marginTop: 10 }}>No token activity yet</Text>
            </View>
          ) : (
            history.map((item: any, i: number) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: i < history.length - 1 ? 1 : 0, borderBottomColor: '#EAF0EC' }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: item.amount > 0 ? '#E5F5F1' : '#FEF2F2', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Ionicons name={item.amount > 0 ? 'add' : 'remove'} size={18} color={item.amount > 0 ? '#087F8C' : '#EF4444'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#153B43' }}>{item.reason || 'Bonus'}</Text>
                  <Text style={{ fontSize: 12, color: '#728A8E', marginTop: 2 }}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: item.amount > 0 ? '#087F8C' : '#EF4444' }}>{item.amount > 0 ? '+' : ''}{item.amount}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
