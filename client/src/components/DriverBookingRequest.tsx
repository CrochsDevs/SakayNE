import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from './ui/Avatar';
import TravelTimeEstimate from './TravelTimeEstimate';
import PickupAccuracyNotice from './PickupAccuracyNotice';
import { useTheme } from '@/src/store/theme';
import { useInterfaceText } from '@/src/i18n/useInterfaceText';
import type { RideBooking } from '@/src/ride/ride.store';

export default function DriverBookingRequest({ ride, count, maxHeight, busy, disabled, onRespond }: {
  ride: RideBooking; count: number; maxHeight: number; busy: boolean; disabled: boolean;
  onRespond: (status: 'accepted' | 'cancelled') => void;
}) {
  const { colors } = useTheme();
  const translate = useInterfaceText();
  const [motion] = useState(() => new Animated.Value(0));
  useEffect(() => {
    motion.setValue(0);
    const animation = Animated.timing(motion, { toValue: 1, duration: 240, useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [motion, ride.id]);
  return <Animated.View testID="incoming-booking-sheet" style={[styles.sheet, { maxHeight, backgroundColor: colors.card, borderColor: colors.border, opacity: motion, transform: [{ translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] }]}>
    <View style={[styles.handle, { backgroundColor: colors.border }]} />
    <View style={styles.heading}><View style={[styles.requestIcon, { backgroundColor: colors.accentSurface }]}><Ionicons name="notifications-outline" size={19} color={colors.onAccent} /></View><Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.grow, { color: colors.text, fontSize: 16, fontWeight: '800', lineHeight: 22 }]}>{translate('New booking request')}</Text>{count > 1 && <View style={[styles.queue, { backgroundColor: colors.accentSurface }]}><Text style={{ color: colors.onAccent, fontSize: 10, fontWeight: '700' }}>{translate('{{count}} waiting', { count })}</Text></View>}</View>
    <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }} contentContainerStyle={styles.body}>
      <View style={styles.passenger}><Avatar name={ride.passengerName || translate('Passenger')} size={46} /><View style={styles.grow}><Text style={{ color: colors.text, fontSize: 16, lineHeight: 23, fontWeight: '700' }}>{ride.passengerName || translate('Passenger')}</Text><Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 3 }}>{translate('{{count}} seat(s)', { count: ride.seats })}</Text></View></View>
      <View style={styles.journey}><View style={styles.railColumn}><Ionicons name="radio-button-on" size={16} color={colors.primaryLight} /><View style={[styles.rail, { backgroundColor: colors.border }]} /><Ionicons name="location" size={18} color={colors.onAccent} /></View><View style={styles.grow}><View style={[styles.stop, { borderColor: colors.borderLight }]}><Text style={[styles.label, { color: colors.textSecondary }]}>{translate('Pickup')}</Text><Text style={[styles.place, { color: colors.text }]}>{ride.pickupLocation ? translate('Passenger GPS pickup') : ride.fromName}</Text>{ride.pickupLocation && <Text style={[styles.label, { color: colors.textSecondary }]}>{translate('Pickup area: {{name}}', { name: ride.fromName })}</Text>}</View><View style={[styles.stop, { borderBottomWidth: 0 }]}><Text style={[styles.label, { color: colors.textSecondary }]}>{translate('Drop-off')}</Text><Text style={[styles.place, { color: colors.text }]}>{ride.toName}</Text></View></View></View>
      <TravelTimeEstimate minutes={ride.minutes} inline />
      {ride.pickupLocation && <PickupAccuracyNotice accuracy={ride.pickupLocation.accuracy} forDriver />}
    </ScrollView>
    <View style={[styles.actions, { borderColor: colors.borderLight }]}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate('Reject booking')} accessibilityState={{ disabled, busy }} disabled={disabled} onPress={() => onRespond('cancelled')} style={[styles.reject, { backgroundColor: colors.coralSurface, borderColor: colors.border, opacity: disabled ? 0.55 : 1 }]}><Ionicons name="close" size={20} color={colors.error} /><Text style={{ color: colors.error, fontSize: 15, fontWeight: '700' }}>{translate('Reject')}</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate('Accept booking')} accessibilityState={{ disabled, busy }} disabled={disabled} onPress={() => onRespond('accepted')} style={[styles.accept, { backgroundColor: colors.primary, opacity: disabled ? 0.55 : 1 }]}>{busy ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="checkmark" size={20} color={colors.onPrimary} />}<Text style={{ color: colors.onPrimary, fontSize: 15, fontWeight: '700' }}>{translate('Accept')}</Text></TouchableOpacity>
    </View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  sheet: { width: '100%', maxWidth: 600, borderRadius: 25, borderWidth: 1, paddingTop: 9, boxShadow: '0 4px 24px rgba(0,0,0,0.14)' }, grow: { flex: 1, minWidth: 0 }, handle: { width: 34, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 10 }, heading: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 16, paddingBottom: 12 }, requestIcon: { width: 33, height: 33, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, queue: { paddingHorizontal: 7, paddingVertical: 5, borderRadius: 8 }, body: { paddingHorizontal: 16, paddingBottom: 13, gap: 10 }, passenger: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  journey: { flexDirection: 'row', gap: 10 }, railColumn: { paddingTop: 15, paddingBottom: 15, alignItems: 'center' }, rail: { flex: 1, width: 1, minHeight: 17, marginVertical: 4 }, stop: { paddingVertical: 8, borderBottomWidth: 1, gap: 2 }, label: { fontSize: 10, lineHeight: 15 }, place: { fontSize: 14, lineHeight: 20, fontWeight: '600' }, actions: { flexDirection: 'row', gap: 10, borderTopWidth: 1, padding: 13 }, reject: { flex: 1, minWidth: 0, minHeight: 50, borderRadius: 15, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, accept: { flex: 1.4, minWidth: 0, minHeight: 50, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
});
