import { useRef, useState } from 'react';
import { TextInput, TouchableOpacity, View, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Card, Label, Action, Loading } from '@/src/components/ui/Screen';
import { useTheme } from '@/src/store/theme';
import { getRide, RideBooking } from '@/src/ride/ride.store';
import { usePolling } from '@/src/ride/usePolling';
import { getReports, REPORT_REASONS, submitReport } from '@/src/reports/reports';
import { showError, showSuccess } from '@/src/utils/toast';

export default function ReportDriverScreen() {
  const { rideId } = useLocalSearchParams<{ rideId?: string }>();
  const { colors } = useTheme();
  const [reason, setReason] = useState<string>('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const { data, error, loading, refresh } = usePolling(async () => {
    if (!rideId) throw new Error('Open a booking from Trips to report its driver.');
    const [ride, page] = await Promise.all([getRide(rideId), getReports('rideId=' + encodeURIComponent(rideId))]);
    return { ride, reported: page.reports.length > 0 };
  }, null as { ride: RideBooking; reported: boolean } | null, 60000);
  const submit = async () => {
    if (!data || !reason || details.trim().length < 10 || submitting.current) return;
    submitting.current = true; setBusy(true);
    try {
      await submitReport(data.ride.id, reason, details.trim());
      showSuccess('Report submitted', 'An admin will review your report.');
      router.replace('/my-reports');
    } catch (e) { showError(e instanceof Error ? e.message : 'Unable to submit report'); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <Screen title="Report driver" back>
    {loading && !data && <Loading />}
    {!!error && <Card><Label>{error}</Label><Action title="Retry" onPress={refresh} /></Card>}
    {data && <>
      <Card><Label strong>{data.ride.driverName}</Label><Label>Plate: {data.ride.vehicle || 'Not recorded'}</Label><Label>{data.ride.fromName} → {data.ride.toName}</Label><Label>Booking #{data.ride.id.slice(-8).toUpperCase()}</Label></Card>
      {data.reported ? <Card><Label strong>You already reported this booking.</Label><Label>You can read the admin response in My reports.</Label><Action title="View My reports" onPress={() => router.replace('/my-reports')} /></Card> : <>
        <Card><Label strong>What happened?</Label><Label>Select a reason for your report.</Label>
          <View accessibilityRole="radiogroup" style={{ gap: 8 }}>{REPORT_REASONS.map(value => <TouchableOpacity key={value} accessibilityRole="radio" accessibilityLabel={value} accessibilityState={{ checked: reason === value, disabled: busy }} disabled={busy} onPress={() => setReason(value)} style={{ minHeight: 48, borderWidth: 1, borderRadius: 14, borderColor: reason === value ? colors.primary : colors.border, backgroundColor: reason === value ? colors.mintSurface : colors.card, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}><Ionicons name={reason === value ? 'radio-button-on' : 'radio-button-off'} size={20} color={reason === value ? colors.primaryLight : colors.textSecondary} /><Text style={{ color: colors.text, flex: 1, fontSize: 14 }}>{value}</Text></TouchableOpacity>)}</View>
        </Card>
        <Card><Label strong>Incident details</Label><Label>Tell us what happened and when. Include the fare charged or nearby landmark if relevant.</Label>
          <TextInput accessibilityLabel="Incident details" value={details} onChangeText={setDetails} editable={!busy} multiline maxLength={2000} textAlignVertical="top" placeholder="Describe the incident (at least 10 characters)" placeholderTextColor={colors.textTertiary} style={{ minHeight: 150, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, color: colors.text, backgroundColor: colors.backgroundAlt, fontSize: 15, lineHeight: 23 }} />
          <Label>{details.length} / 2000</Label><Label>Your report goes to Sakay admins. Your driver cannot view it.</Label>
        </Card>
        <Label>Reports are reviewed by admins and are not monitored as an emergency service.</Label>
        <Action title={busy ? 'Submitting…' : 'Submit report'} disabled={busy || !reason || details.trim().length < 10 || !!error} onPress={() => { void submit(); }} />
      </>}
    </>}
  </Screen>;
}
