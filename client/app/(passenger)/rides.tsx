import { useInterfaceText } from '@/src/i18n/useInterfaceText';
import { useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getRides, RideBooking, RideStatus, isActiveRide } from '@/src/ride/ride.store';
import { usePolling } from '@/src/ride/usePolling';
import { useTheme } from '@/src/store/theme';
import CommuteScene from '@/src/components/ui/CommuteScene';
import TravelTimeEstimate from '@/src/components/TravelTimeEstimate';

const FILTERS = [
  { id: 'all', label: 'All' }, { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' }, { id: 'cancelled', label: 'Cancelled' },
] as const;
type RideFilter = typeof FILTERS[number]['id'];
const STATUS_LABELS: Record<RideStatus, string> = {
  pending: 'Pending', accepted: 'Accepted', arrived: 'Arrived', ongoing: 'On board', completed: 'Completed', cancelled: 'Cancelled',
};
const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

function TripCard({ ride }: { ride: RideBooking }) {
  const { colors } = useTheme();
  const translate = useInterfaceText();
  const cancelled = ride.status === 'cancelled';
  const completed = ride.status === 'completed';
  const statusColor = cancelled ? colors.error : completed ? colors.success : colors.onAccent;
  const statusBackground = cancelled ? colors.coralSurface : completed ? colors.mintSurface : colors.accentSurface;
  const date = new Date(ride.createdAt).toLocaleDateString(translate("dateLocale"), { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });

  return <View style={[styles.tripCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <View style={styles.cardHeading}>
      <View style={[styles.vehicleIcon, { backgroundColor: colors.mintSurface }]}>
        {ride.type === 'bus' ? <Ionicons name="bus-outline" size={24} color={colors.primaryLight} /> : <Image source={require('../../assets/icon/jeepney.png')} resizeMode="contain" tintColor={colors.primaryLight} style={{ width: 34, height: 34 }} />}
      </View>
      <View style={styles.vehicleMeta}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{ride.type === 'bus' ? 'Bus' : 'Jeepney'}<Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '400' }}> · {translate(ride.seats === 1 ? "{{count}} seat" : "{{count}} seats", { count: ride.seats })}</Text></Text>
        <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 4 }}>{date}</Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: statusBackground }]}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={{ color: statusColor, fontSize: 10, fontWeight: '700' }}>{translate(STATUS_LABELS[ride.status])}</Text>
      </View>
    </View>

    <View style={styles.route}>
      <View style={styles.stopRow}>
        <View style={styles.markerColumn}><View style={[styles.pickupDot, { borderColor: colors.primaryLight }]} /><View style={[styles.connector, { borderColor: colors.border }]} /></View>
        <View style={styles.stopText}><Text style={[styles.stopLabel, { color: colors.textTertiary }]}>{translate("PICKUP")}</Text><Text style={[styles.stopName, { color: colors.text }]}>{ride.fromName}</Text></View>
      </View>
      <View style={styles.stopRow}>
        <View style={styles.markerColumn}><Ionicons name="location" size={16} color={colors.accent} /></View>
        <View style={styles.stopText}><Text style={[styles.stopLabel, { color: colors.textTertiary }]}>{translate("DROP-OFF")}</Text><Text style={[styles.stopName, { color: colors.text }]}>{ride.toName}</Text></View>
      </View>
    </View>

    <TravelTimeEstimate minutes={ride.minutes} compact historical={!isActiveRide(ride)} />
    <View style={[styles.driverRow, { borderColor: colors.borderLight }]}>
      <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
      <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, flex: 1 }}>{ride.driverName}</Text>
      <Text numberOfLines={1} style={{ color: colors.textTertiary, fontSize: 11, maxWidth: '40%' }}>{ride.vehicle}</Text>
    </View>
    <View style={styles.cardFooter}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate("Booking details")} accessibilityHint={`${ride.fromName} to ${ride.toName}, ${translate(STATUS_LABELS[ride.status])}`} onPress={() => router.push({ pathname: '/ride-tracking', params: { rideId: ride.id } })} style={[styles.detailsButton, { backgroundColor: colors.mintSurface }]}>
        <Text style={{ color: colors.primaryLight, fontSize: 12, fontWeight: '700' }}>{translate("View details")}</Text><Ionicons name="arrow-forward" size={16} color={colors.primaryLight} />
      </TouchableOpacity>
    </View>
  </View>;
}

export default function RidesScreen() {
  const { colors, brand } = useTheme();
  const translate = useInterfaceText();
  const ready = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
  const { data: rides, loading, error, refresh } = usePolling(getRides, [] as RideBooking[]);
  const [filter, setFilter] = useState<RideFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const filtered = rides.filter(ride => filter === 'all' || (filter === 'active' ? isActiveRide(ride) : ride.status === filter)).sort((a, b) => b.createdAt - a.createdAt);
  const refreshRides = async () => {
    setRefreshing(true);
    try { await refresh(); } finally { setRefreshing(false); }
  };

  // The static export has no passenger session or ride history yet.
  if (!ready) return <SafeAreaView style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.primaryLight} /></SafeAreaView>;

  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
    <FlatList data={filtered} keyExtractor={ride => ride.id} renderItem={({ item }) => <TripCard ride={item} />} showsVerticalScrollIndicator={false} contentContainerStyle={styles.list} refreshing={refreshing} onRefresh={() => { void refreshRides(); }}
      ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
      ListHeaderComponent={<View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}><Text style={[styles.title, { color: colors.text }]}>{translate("My rides")}</Text><Text style={[styles.subtitle, { color: colors.textSecondary }]}>{translate("All your trips, in one place.")}</Text></View>
          <View style={[styles.headerIcon, { backgroundColor: colors.accentSurface }]}><Ionicons name="ticket-outline" size={25} color={colors.onAccent} /></View>
        </View>
        <View style={[styles.filters, { backgroundColor: colors.backgroundAlt, borderColor: colors.borderLight }]}>
          {FILTERS.map(item => <TouchableOpacity key={item.id} accessibilityRole="button" accessibilityLabel={translate(item.label)} accessibilityState={{ selected: filter === item.id }} onPress={() => setFilter(item.id)} style={[styles.filter, { backgroundColor: filter === item.id ? colors.primary : 'transparent' }]}><Text style={{ color: filter === item.id ? '#FFFFFF' : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>{translate(item.label)}</Text></TouchableOpacity>)}
        </View>
        <View style={styles.historyHeading}><Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{filter === 'all' ? translate("Trip history") : translate("{{status}} trips", { status: translate(FILTERS.find(item => item.id === filter)?.label || "All") })}</Text><View style={[styles.countBadge, { backgroundColor: colors.mintSurface }]}><Text style={{ color: colors.primaryLight, fontSize: 11, fontWeight: '600' }}> {translate(filtered.length === 1 ? "{{count}} trip" : "{{count}} trips", { count: filtered.length })}</Text></View></View>
        {loading && <ActivityIndicator style={{ paddingVertical: 20 }} color={colors.primaryLight} />}
        {!!error && <View style={[styles.error, { backgroundColor: colors.coralSurface }]}><Ionicons name="cloud-offline-outline" size={20} color={colors.error} /><Text style={{ flex: 1, color: colors.error, fontSize: 12, lineHeight: 18 }}>{error}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={translate("Retry loading rides")} onPress={refresh} style={styles.retry}><Text style={{ color: colors.error, fontSize: 12, fontWeight: '700' }}>{translate("Retry")}</Text></TouchableOpacity></View>}
      </View>}
      ListEmptyComponent={!loading && !error ? <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.emptyScene, { backgroundColor: colors.accentSurface }]}><CommuteScene /></View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>{filter === 'all' ? translate("Your next story awaits") : translate("Nothing here just yet")}</Text>
        <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>{filter === 'all' ? translate("Book your first ride and we’ll save the journey here.") : translate("Your {{status}} trips will appear here.", { status: translate(FILTERS.find(item => item.id === filter)?.label || "All").toLowerCase() })}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate("Plan a trip")} onPress={() => router.push('/journey-search')} style={[styles.planButton, { backgroundColor: colors.primary }]}><Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>{translate("Plan a trip")}</Text><Ionicons name="arrow-forward" size={18} color={brand.sunshine} /></TouchableOpacity>
      </View> : null}
    />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  list: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 20, paddingBottom: 28 },
  header: { gap: 22, paddingTop: 6, paddingBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { fontSize: 29, fontWeight: '900', letterSpacing: -0.9 },
  subtitle: { fontSize: 13, lineHeight: 20, marginTop: 6 },
  headerIcon: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] },
  filters: { flexDirection: 'row', padding: 4, gap: 3, borderRadius: 17, borderWidth: 1 },
  filter: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 13, paddingHorizontal: 3 },
  historyHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  tripCard: { borderWidth: 1, borderRadius: 24, padding: 17 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vehicleIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  vehicleMeta: { flex: 1, minWidth: 0 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 10 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  route: { marginTop: 19, marginBottom: 15 },
  stopRow: { flexDirection: 'row', gap: 10 },
  markerColumn: { width: 16, alignItems: 'center', paddingTop: 3 },
  pickupDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  connector: { flex: 1, minHeight: 20, borderLeftWidth: 1.5, borderStyle: 'dashed', marginTop: 6, marginBottom: 3 },
  stopText: { flex: 1, minWidth: 0, gap: 4, paddingBottom: 13 },
  stopLabel: { fontSize: 9, fontWeight: '600', letterSpacing: 1 },
  stopName: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 7, borderTopWidth: 1, paddingTop: 13, paddingBottom: 16 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  detailsButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, minHeight: 44, paddingHorizontal: 13 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 15, padding: 12 },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 7 },
  emptyCard: { padding: 20, borderWidth: 1, borderRadius: 24, alignItems: 'center' },
  emptyScene: { width: '100%', borderRadius: 19, padding: 12, marginBottom: 20 },
  emptyTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  emptyDescription: { fontSize: 13, lineHeight: 22, textAlign: 'center', marginTop: 9 },
  planButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 50, paddingHorizontal: 23, borderRadius: 16, marginTop: 20 },
});
