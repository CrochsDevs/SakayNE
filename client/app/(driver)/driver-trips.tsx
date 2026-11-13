import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DriverBookings from '@/src/components/DriverBookings';
import { getRides, changeRideStatus, type RideStatus } from '@/src/ride/ride.store';
import { getDriverProfile } from '@/src/ride/driver.service';
import { usePolling } from '@/src/ride/usePolling';
import { useTheme } from '@/src/store/theme';
import { useInterfaceText } from '@/src/i18n/useInterfaceText';
import { showError } from '@/src/utils/toast';

export default function DriverTripsScreen() {
  const { colors, brand } = useTheme();
  const translate = useInterfaceText();
  const { data, loading, error, refresh } = usePolling(async () => {
    const [rides, driver] = await Promise.all([getRides(), getDriverProfile()]);
    return { rides, driver };
  }, null as { rides: Awaited<ReturnType<typeof getRides>>; driver: Awaited<ReturnType<typeof getDriverProfile>> } | null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRideId, setSelectedRideId] = useState('');
  const updateStatus = async (id: string, status: RideStatus, code?: string) => {
    if (busy) return;
    setBusy(true);
    try { await changeRideStatus(id, status, code); await refresh(); }
    catch (error) { showError(error instanceof Error ? error.message : translate('Request failed')); }
    finally { setBusy(false); }
  };
  const refreshTrips = async () => {
    setRefreshing(true);
    try { await refresh(); } finally { setRefreshing(false); }
  };

  return <SafeAreaView testID="driver-trips-screen" edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void refreshTrips(); }} tintColor={colors.primaryLight} />}>
      <View style={styles.header}><Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{translate('Trips')}</Text><View style={[styles.underline, { backgroundColor: brand.sunshine }]} /><Text style={[styles.description, { color: colors.textSecondary }]}>{translate('Track your active and past trips.')}</Text></View>
      {!!error && <View style={[styles.error, { backgroundColor: colors.coralSurface }]}><Ionicons name="cloud-offline-outline" size={22} color={colors.error} /><Text style={{ color: colors.error, flex: 1, fontSize: 13, lineHeight: 20 }}>{error}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={translate('Retry')} onPress={refresh} style={styles.retry}><Text style={{ color: colors.error, fontWeight: '700' }}>{translate('Retry')}</Text></TouchableOpacity></View>}
      <DriverBookings showHeading={false} rides={data?.rides || []} loading={loading} error={error} busy={busy} online={!!data?.driver.isAvailable} selectedRideId={selectedRideId} onSelect={setSelectedRideId} onStatusChange={(id, status, code) => { void updateStatus(id, status, code); }} />
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 28, width: '100%', maxWidth: 760, alignSelf: 'center', gap: 18 },
  header: { gap: 10, paddingTop: 8 }, title: { fontSize: 29, lineHeight: 37, fontWeight: '900', letterSpacing: -0.8 }, underline: { width: 43, height: 5, borderRadius: 3 }, description: { fontSize: 13, lineHeight: 21, marginTop: 3 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderRadius: 16 }, retry: { minHeight: 44, paddingHorizontal: 6, justifyContent: 'center' },
});
