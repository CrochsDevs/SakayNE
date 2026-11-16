import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Avatar from './ui/Avatar';
import PickupAccuracyNotice from './PickupAccuracyNotice';
import TravelTimeEstimate from './TravelTimeEstimate';
import { Action } from './ui/Screen';
import { useTheme } from '@/src/store/theme';
import { useInterfaceText } from '@/src/i18n/useInterfaceText';
import { isActiveRide, type RideBooking, type RideStatus } from '@/src/ride/ride.store';

const filters = ['Active', 'Completed', 'Cancelled'] as const;
const nextAction: Partial<Record<RideStatus, { status: RideStatus; title: string }>> = {
  pending: { status: 'accepted', title: 'Accept booking' },
};

type Props = {
  showHeading?: boolean;
  rides: RideBooking[];
  busy: boolean;
  loading: boolean;
  error: string | null;
  online: boolean;
  selectedRideId?: string;
  onSelect: (id: string) => void;
  onStatusChange: (id: string, status: RideStatus) => void;
};

export default function DriverBookings({ showHeading = true, rides, busy, loading, error, online, selectedRideId, onSelect, onStatusChange }: Props) {
  const { colors, isDark, brand } = useTheme();
  const translate = useInterfaceText();
  const [filter, setFilter] = useState<typeof filters[number]>('Active');
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const groups = {
    Active: rides.filter(isActiveRide),
    Completed: rides.filter(ride => ride.status === 'completed'),
    Cancelled: rides.filter(ride => ride.status === 'cancelled'),
  };
  const visible = [...groups[filter]].sort((a, b) => b.createdAt - a.createdAt);

  return <View style={styles.section}>
    {showHeading && <View style={styles.headingRow}>
      <View style={[styles.headingIcon, { backgroundColor: colors.accentSurface }]}><Ionicons name="ticket-outline" size={21} color={colors.onAccent} /></View>
      <View style={styles.grow}><Text style={[styles.heading, { color: colors.text }]}>{translate('Bookings')}</Text><Text style={[styles.caption, { color: colors.textSecondary }]}>{translate('Your passengers, all in one place.')}</Text></View>
    </View>}
    <View accessibilityRole="tablist" style={[styles.tabs, { borderColor: colors.border }]}>
      {filters.map(item => <TouchableOpacity key={item} accessibilityRole="tab" accessibilityLabel={translate(item)} accessibilityState={{ selected: filter === item }} aria-selected={filter === item} onPress={() => setFilter(item)} style={[styles.tab, { borderBottomColor: filter === item ? brand.sunshine : 'transparent' }]}>
        <Text style={{ color: filter === item ? colors.primaryLight : colors.textSecondary, fontSize: 12, fontWeight: filter === item ? '800' : '500', textAlign: 'center' }}>{translate(item)}</Text>
        <View style={[styles.tabCount, { backgroundColor: filter === item ? colors.accentSurface : colors.backgroundAlt }]}><Text style={{ color: filter === item ? colors.onAccent : colors.textSecondary, fontSize: 10, fontWeight: '700' }}>{groups[item].length}</Text></View>
      </TouchableOpacity>)}
    </View>
    {loading && !rides.length && <ActivityIndicator color={colors.primaryLight} />}
    {!loading && !error && visible.length === 0 && <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.mintSurface }]}><Ionicons name={filter === 'Completed' ? 'checkmark-done-outline' : filter === 'Cancelled' ? 'close-circle-outline' : 'radio-outline'} size={28} color={colors.primaryLight} /></View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{translate(filter === 'Completed' ? 'No completed trips yet.' : filter === 'Cancelled' ? 'No cancelled bookings.' : online ? 'Ready for your next pickup' : 'Your next trip starts here')}</Text>
      {filter === 'Active' && <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{translate(online ? 'Waiting for booking requests. Keep Sakay open to share GPS.' : 'Go online to receive bookings and share your driver location.')}</Text>}
    </View>}
    {visible.map(ride => {
      const active = isActiveRide(ride);
      const expanded = expandedCards[ride.id] ?? active;
      const name = ride.passengerName || translate('Passenger');
      const status = translate(ride.status.charAt(0).toUpperCase() + ride.status.slice(1));
      const statusBg = ride.status === 'cancelled' ? colors.coralSurface : ride.status === 'completed' ? colors.mintSurface : colors.accentSurface;
      const statusColor = ride.status === 'cancelled' ? colors.error : ride.status === 'completed' ? colors.primaryLight : colors.onAccent;
      const created = new Date(ride.createdAt);
      const date = Number.isFinite(created.getTime()) ? created.toLocaleString(translate('dateLocale'), { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
      const action = nextAction[ride.status];
      return <View key={ride.id} testID={`driver-booking-${ride.id}`} style={[styles.card, { backgroundColor: colors.card, borderColor: active && selectedRideId === ride.id ? colors.borderFocused : colors.border, boxShadow: isDark ? '0 3px 10px rgba(0,0,0,0.12)' : '0 3px 12px rgba(21,59,67,0.04)' }]}>
        <View style={styles.statusRow}><View style={[styles.status, { backgroundColor: statusBg }]}><View style={[styles.dot, { backgroundColor: statusColor }]} /><Text style={{ color: statusColor, fontSize: 11, fontWeight: '700' }}>{status}</Text></View></View>
        <View style={styles.profile}>
          <View style={[styles.avatar, { borderColor: colors.borderFocused, backgroundColor: colors.mintSurface }]}><Avatar name={name} size={52} /></View>
          <View style={styles.grow}><Text style={[styles.name, { color: colors.text }]}>{name}</Text><Text style={[styles.reference, { color: colors.textSecondary }]}>{translate('Booking #{{reference}}', { reference: ride.id.slice(-8).toUpperCase() })}</Text></View>
        </View>
        <View style={[styles.metrics, { borderColor: colors.borderLight }]}>
          {[
            { icon: 'people-outline' as const, value: translate('{{count}} seat(s)', { count: ride.seats }) },
          ].map(metric => <View key={metric.icon} style={styles.metric}><Ionicons name={metric.icon} size={17} color={colors.primaryLight} /><Text style={{ color: colors.text, fontSize: 12, lineHeight: 18, fontWeight: '600', textAlign: 'center' }}>{metric.value}</Text></View>)}
        </View>
        <TravelTimeEstimate minutes={ride.minutes} compact historical={!active} />
        <View style={styles.dateRow}><Text style={[styles.caption, { color: colors.textSecondary }]}>{translate('Date booked')}</Text><Text style={[styles.date, { color: colors.text }]}>{date}</Text></View>
        <View style={styles.journey}>
          <View style={styles.journeyRail}><Ionicons name="radio-button-on" size={17} color={colors.primaryLight} /><View style={[styles.rail, { backgroundColor: colors.border }]} /><Ionicons name="location" size={19} color={colors.onAccent} /></View>
          <View style={styles.grow}><View style={[styles.stop, { borderColor: colors.borderLight }]}><Text style={[styles.stopLabel, { color: colors.textSecondary }]}>{translate('Pickup')}</Text><Text style={[styles.stopName, { color: colors.text }]}>{ride.pickupLocation ? translate('Passenger GPS pickup') : ride.fromName}</Text>{ride.pickupLocation && <Text style={[styles.caption, { color: colors.textSecondary }]}>{translate('Pickup area: {{name}}', { name: ride.fromName })}</Text>}</View><View style={[styles.stop, styles.lastStop]}><Text style={[styles.stopLabel, { color: colors.textSecondary }]}>{translate('Drop-off')}</Text><Text style={[styles.stopName, { color: colors.text }]}>{ride.toName}</Text></View></View>
        </View>
        {expanded && <View style={styles.details}>
          {ride.pickupLocation && <PickupAccuracyNotice accuracy={ride.pickupLocation.accuracy} forDriver />}
          <View style={[styles.vehicleRow, { borderColor: colors.borderLight }]}><Text style={[styles.caption, { color: colors.textSecondary }]}>{translate('Vehicle')}</Text><Text style={{ color: colors.text, fontSize: 12, fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>{translate(ride.type === 'bus' ? 'Bus' : 'Jeepney')} · {ride.vehicle}</Text></View>
          {active ? <>
            <View accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: colors.mintSurface, flexDirection: 'row', alignItems: 'center', gap: 8 }]}><Ionicons name="navigate-outline" size={17} color={colors.primaryLight} /><Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 19, flex: 1 }}>{ride.partyDistanceMeters != null ? translate('You are about {{distance}} m apart (GPS estimate)', { distance: ride.partyDistanceMeters }) : translate('Waiting for fresh GPS from both phones to show distance.')}</Text></View>
            <Text style={[styles.notice, { backgroundColor: colors.backgroundAlt, color: colors.textSecondary }]}>{translate(ride.occupancyStatus === 'alighted' ? 'Passenger alighted · seats released' : ride.status === 'ongoing' ? 'Passenger on board · GPS will complete the trip after drop-off.' : ride.status === 'arrived' ? 'Waiting for GPS boarding confirmation.' : ride.status === 'accepted' ? 'Waiting for GPS boarding confirmation.' : 'Seats reserved · waiting to board')}</Text>
            <View style={styles.links}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate('Passenger trip details')} onPress={() => { onSelect(ride.id); router.push({ pathname: '/driver-trip', params: { rideId: ride.id } }); }} style={[styles.link, { backgroundColor: colors.backgroundAlt }]}><Ionicons name="map-outline" size={18} color={colors.primaryLight} /><Text style={[styles.linkText, { color: colors.text }]}>{translate('Trip details')}</Text></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate('Message passenger')} onPress={() => router.push({ pathname: '/ride-chat', params: { rideId: ride.id } })} style={[styles.link, { backgroundColor: colors.mintSurface }]}><Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primaryLight} /><Text style={[styles.linkText, { color: colors.text }]}>{translate('Message')}</Text></TouchableOpacity>
            </View>
            {action && <Action disabled={busy} title={translate(action.title)} onPress={() => { onSelect(ride.id); onStatusChange(ride.id, action.status); }} />}
            {ride.status !== 'ongoing' && <Action disabled={busy} secondary title={translate(ride.status === 'pending' ? 'Decline booking' : 'Cancel booking')} onPress={() => onStatusChange(ride.id, 'cancelled')} />}
          </> : <>
            {ride.status === 'completed' && ride.rating != null && <View style={styles.vehicleRow}><Text style={[styles.caption, { color: colors.textSecondary }]}>{translate('Trip rating')}</Text><View style={styles.rating}><Ionicons name="star" size={14} color={colors.onAccent} /><Text style={{ color: colors.text, fontSize: 12 }}>{ride.rating.toFixed(1)}</Text></View></View>}
            <Text style={[styles.caption, { color: ride.status === 'cancelled' ? colors.error : colors.textSecondary }]}>{ride.status === 'cancelled' ? ride.cancellationReason || translate('This booking was cancelled.') : translate('Trip completed.')}</Text>
            <Action secondary title={translate('Booking details')} onPress={() => router.push({ pathname: '/driver-trip', params: { rideId: ride.id } })} />
          </>}
        </View>}
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate(expanded ? 'Collapse booking for {{name}}' : 'Expand booking for {{name}}', { name })} accessibilityState={{ expanded }} onPress={() => { setExpandedCards(previous => ({ ...previous, [ride.id]: !expanded })); if (active) onSelect(ride.id); }} style={styles.expand}>
          <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600' }}>{translate(expanded ? 'Less details' : 'More details')}</Text><Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={17} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 14 }, grow: { flex: 1, minWidth: 0 },
  headingRow: { flexDirection: 'row', gap: 11, alignItems: 'center' }, headingIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, heading: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }, caption: { fontSize: 12, lineHeight: 18 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 }, tab: { flex: 1, minWidth: 0, minHeight: 56, borderBottomWidth: 3, paddingVertical: 9, paddingHorizontal: 2, flexDirection: 'row', flexWrap: 'wrap', gap: 5, justifyContent: 'center', alignItems: 'center' }, tabCount: { minWidth: 20, height: 20, borderRadius: 7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  card: { padding: 16, borderWidth: 1, borderRadius: 22 }, statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 13 }, status: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 }, dot: { width: 5, height: 5, borderRadius: 3 }, rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  profile: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 16 }, avatar: { width: 60, height: 60, padding: 3, borderWidth: 1, borderRadius: 30, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }, name: { fontSize: 16, lineHeight: 23, fontWeight: '700' }, reference: { fontSize: 11, lineHeight: 17, marginTop: 4 },
  metrics: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 13, gap: 6 }, metric: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 5 },
  dateRow: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6, paddingVertical: 12 }, date: { flex: 1, minWidth: 130, fontSize: 11, lineHeight: 18, fontWeight: '600', textAlign: 'right' },
  journey: { flexDirection: 'row', gap: 11 }, journeyRail: { alignItems: 'center', paddingTop: 18, paddingBottom: 18 }, rail: { flex: 1, width: 1, minHeight: 23, marginVertical: 5 }, stop: { paddingVertical: 11, borderBottomWidth: 1, gap: 3 }, lastStop: { borderBottomWidth: 0 }, stopLabel: { fontSize: 10, lineHeight: 15 }, stopName: { fontSize: 14, lineHeight: 21, fontWeight: '600' },
  details: { gap: 12 }, vehicleRow: { borderTopWidth: 1, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, notice: { fontSize: 12, lineHeight: 19, padding: 12, borderRadius: 12 }, links: { flexDirection: 'row', gap: 8 }, link: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 9, minHeight: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, linkText: { fontSize: 12, fontWeight: '600' }, input: { minHeight: 52, padding: 14, borderRadius: 14, borderWidth: 1 },
  expand: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 7 },
  empty: { padding: 24, borderWidth: 1, borderRadius: 22, alignItems: 'center', gap: 10 }, emptyIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' }, emptyText: { fontSize: 13, lineHeight: 21, textAlign: 'center' },
});
