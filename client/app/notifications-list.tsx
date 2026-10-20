import { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/store/theme';
import { getCurrentUser, getNotifications, markNotifRead } from '@/src/auth/auth.service';
import { showError } from '@/src/utils/toast';
import { useTranslation } from 'react-i18next';

const ICONS: Record<string, any> = {
  welcome: 'happy-outline',
  booking: 'checkmark-circle-outline',
  nearby: 'navigate-outline',
  promo: 'pricetag-outline',
  alert: 'alert-circle-outline',
};

const COLORS: Record<string, string> = {
  welcome: '#3F8451',
  booking: '#5AA06D',
  nearby: '#2E6B3F',
  promo: '#B8860B',
  alert: '#C0392B',
};

export default function NotificationsListScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [notifs, setNotifs] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const filtered = notifs.filter((n) => filter === 'all' ? true : filter === 'unread' ? !n.read : n.read);

  useFocusEffect(useCallback(() => { void load(); }, []));

  const load = async () => {
    const user = await getCurrentUser();
    if (user?.email) {
      try { const data = await getNotifications(user.email); setNotifs(data); } catch(e) { showError('Unable to load notifications', e instanceof Error ? e.message : 'Retry later'); }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const markAllRead = async () => {
    const user = await getCurrentUser();
    if (user?.email) {
      try { await markNotifRead(user.email); setNotifs((prev) => prev.map((n) => ({ ...n, read: true }))); } catch(e) { showError('Unable to mark notifications', e instanceof Error ? e.message : 'Retry later'); }
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.backgroundAlt, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{t('notification.title')}</Text>
        {notifs.some((n) => !n.read) && (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>{t('notification.markAllRead')}</Text>
          </TouchableOpacity>
        )}
        {!notifs.some((n) => !n.read) && <View style={{ width: 80 }} />}
      </View>

      <View style={{ flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 12, gap: 8 }}>
        {(['all', 'unread', 'read'] as const).map((f) => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)}
            style={{ paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: filter === f ? colors.primary : colors.backgroundAlt }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: filter === f ? '#fff' : colors.textSecondary, textTransform: 'capitalize' }}>{t(`notification.${f}`)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        <View style={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 24 }}>
          {filtered.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Ionicons name="notifications-off-outline" size={48} color={colors.textTertiary} />
              <Text style={{ fontSize: 16, color: colors.textTertiary, marginTop: 16 }}>{t('notification.noNotifications')}</Text>
            </View>
          ) : (
            filtered.map((notif: any, i: number) => (
              <TouchableOpacity
                key={notif._id || i}
                onPress={async () => { try { await markNotifRead(notif.email, notif._id); await load(); if (notif.rideId) { const u = await getCurrentUser(); router.push({ pathname: u?.role === 'driver' ? '/driver-trip' : '/ride-tracking', params: { rideId: notif.rideId } }); } } catch(e) { showError('Unable to open notification', e instanceof Error ? e.message : 'Retry later'); } }}
                style={{ flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: i < filtered.length - 1 ? 1 : 0, borderBottomColor: colors.borderLight, opacity: notif.read ? 0.6 : 1 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: (COLORS[notif.type] || colors.primary) + '15', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                  <Ionicons name={ICONS[notif.type] || 'notifications-outline'} size={20} color={COLORS[notif.type] || colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {!notif.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginRight: 6 }} />}
                    <Text style={{ fontSize: 14, fontWeight: notif.read ? '400' : '600', color: colors.text, flex: 1 }}>{notif.title}</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{notif.message}</Text>
                  <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 4, opacity: 0.6 }}>
                    {notif.createdAt ? new Date(notif.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
