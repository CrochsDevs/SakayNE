import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Avatar from '@/src/components/ui/Avatar';
import { getCurrentUser } from '@/src/auth/auth.service';
import { getRides, isActiveRide, RideBooking } from '@/src/ride/ride.store';
import { usePolling } from '@/src/ride/usePolling';
import { useTheme } from '@/src/store/theme';

export default function Messages() {
  const { colors, isDark } = useTheme();
  const accent = isDark ? '#5AAFFF' : '#0078E8';
  const [query, setQuery] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const { data, loading, error, refresh } = usePolling(async () => {
    const [user, rides] = await Promise.all([getCurrentUser(), getRides()]);
    return { isDriver: user?.role === 'driver', rides };
  }, null as { isDriver: boolean; rides: RideBooking[] } | null);
  const nameFor = (ride: RideBooking) => data?.isDriver ? ride.passengerName || 'Passenger' : ride.driverName || 'Driver';
  const rides = [...(data?.rides || [])]
    .filter(ride => (!activeOnly || isActiveRide(ride)) && `${nameFor(ride)} ${ride.fromName} ${ride.toName}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => Number(isActiveRide(b)) - Number(isActiveRide(a)) || b.createdAt - a.createdAt);

  return <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
    <View style={styles.header}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.iconButton}>
        <Ionicons name="arrow-back" size={26} color={accent} />
      </TouchableOpacity>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Messages</Text>
      <View style={[styles.headerIcon, { backgroundColor: isDark ? '#173759' : '#E9F3FF' }]}><Ionicons name="chatbubbles" size={24} color={accent} /></View>
    </View>
    <View style={[styles.search, { backgroundColor: colors.backgroundAlt }]}>
      <Ionicons name="search" size={21} color={colors.textSecondary} />
      <TextInput accessibilityLabel="Search conversations" placeholder="Search chats" placeholderTextColor={colors.textSecondary} value={query} onChangeText={setQuery}
        style={[styles.searchInput, { color: colors.text }]} />
      {!!query && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} style={styles.iconButton}><Ionicons name="close-circle" size={22} color={colors.textSecondary} /></TouchableOpacity>}
    </View>
    <View style={styles.filters}>
      {[{ title: 'All chats', active: false }, { title: 'Active bookings', active: true }].map(filter => <TouchableOpacity key={filter.title}
        accessibilityRole="button" accessibilityState={{ selected: activeOnly === filter.active }} onPress={() => setActiveOnly(filter.active)}
        style={[styles.filter, { backgroundColor: activeOnly === filter.active ? isDark ? '#173759' : '#E9F3FF' : colors.background }]}>
        <Text style={[styles.filterText, { color: activeOnly === filter.active ? accent : colors.textSecondary }]}>{filter.title}</Text>
      </TouchableOpacity>)}
    </View>
    {!!error && <View style={[styles.notice, { backgroundColor: colors.backgroundAlt }]}>
      <Text style={[styles.description, { color: colors.error, flex: 1 }]}>{error}</Text>
      <TouchableOpacity accessibilityRole="button" onPress={refresh} style={styles.iconButton}><Text style={{ color: accent, fontWeight: '700' }}>Retry</Text></TouchableOpacity>
    </View>}
    <FlatList data={rides} keyExtractor={ride => ride.id} refreshing={loading} onRefresh={refresh} contentContainerStyle={styles.list}
      ListEmptyComponent={<View style={styles.empty}>
        {loading ? <ActivityIndicator color={accent} /> : <>
          <View style={[styles.emptyIcon, { backgroundColor: isDark ? '#173759' : '#E9F3FF' }]}><Ionicons name="chatbubbles-outline" size={40} color={accent} /></View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{query || activeOnly ? 'No matching conversations' : 'No conversations yet'}</Text>
          <Text style={[styles.description, { color: colors.textSecondary, textAlign: 'center' }]}>{query ? 'Try another name or destination.' : data?.isDriver ? 'Chats with your booked passengers appear here.' : 'Book a jeepney or bus to chat with your driver.'}</Text>
        </>}
      </View>}
      renderItem={({ item: ride }) => {
        const name = nameFor(ride), active = isActiveRide(ride);
        return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Message ${name}, ${ride.fromName} to ${ride.toName}${active ? '' : ', closed booking'}`}
          onPress={() => router.push({ pathname: '/ride-chat', params: { rideId: ride.id } })} style={styles.conversation}>
          <Avatar name={name} size={56} />
          <View style={styles.conversationBody}>
            <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>{name}</Text>
            <Text numberOfLines={1} style={[styles.description, { color: colors.textSecondary }]}>{ride.fromName} → {ride.toName}</Text>
            <Text style={[styles.bookingState, { color: active ? accent : colors.textSecondary }]}>{active ? 'Active booking · Send a message' : 'Booking ended · View chat'}</Text>
          </View>
          <Ionicons name={active ? 'chatbubble-outline' : 'lock-closed-outline'} size={18} color={active ? accent : colors.textTertiary} />
        </TouchableOpacity>;
      }} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 28, fontWeight: '800', letterSpacing: -0.7 }, headerIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  search: { marginHorizontal: 20, marginTop: 6, borderRadius: 26, minHeight: 50, paddingLeft: 16, paddingRight: 6, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, fontSize: 17, minHeight: 50, minWidth: 0 }, filters: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 16, gap: 8, flexWrap: 'wrap' },
  filter: { borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12, minHeight: 44 }, filterText: { fontSize: 15, fontWeight: '700' },
  list: { flexGrow: 1, paddingBottom: 24 }, conversation: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14, minHeight: 96 },
  conversationBody: { flex: 1, minWidth: 0, gap: 4 }, name: { fontSize: 18, fontWeight: '700' }, description: { fontSize: 15, lineHeight: 22 }, bookingState: { fontSize: 13, lineHeight: 19 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 }, emptyIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 21, fontWeight: '700', textAlign: 'center' }, notice: { marginHorizontal: 20, padding: 12, borderRadius: 12, flexDirection: 'row', gap: 8, alignItems: 'center' },
});
