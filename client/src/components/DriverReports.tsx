import { useCallback, useRef, useState } from 'react';
import { TextInput, View, Text, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Action, Card, Label, Loading } from './ui/Screen';
import { useTheme } from '@/src/store/theme';
import { DriverReport, getReports, REPORT_STATUSES, ReportStatus, reviewReport } from '@/src/reports/reports';
import { showError, showSuccess } from '@/src/utils/toast';

function ReportCard({ report, admin, onUpdated }: { report: DriverReport; admin: boolean; onUpdated: () => void }) {
  const { colors } = useTheme();
  const [status, setStatus] = useState<ReportStatus>(report.status);
  const [response, setResponse] = useState(report.adminResponse || '');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const save = async () => {
    if (saving.current) return;
    saving.current = true; setBusy(true);
    try { await reviewReport(report.id, status, response.trim()); showSuccess('Report updated'); onUpdated(); }
    catch (e) { showError(e instanceof Error ? e.message : 'Unable to update report'); }
    finally { saving.current = false; setBusy(false); }
  };
  return <Card>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><View style={{ flex: 1 }}><Label strong>{report.reason}</Label></View><Text style={{ color: colors.primaryLight, fontWeight: '700', fontSize: 12 }}>{REPORT_STATUSES[report.status]}</Text></View>
    <Label>{report.driverName} · {report.vehicle || 'Plate not recorded'}</Label>
    <Label>{report.fromName} → {report.toName}</Label>
    <Label>Booking #{report.rideId.slice(-8).toUpperCase()} · {new Date(report.createdAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</Label>
    {admin && <Label>Passenger: {report.passengerName} ({report.passengerEmail})</Label>}
    <Text selectable style={{ color: colors.text, lineHeight: 23, fontSize: 15 }}>{report.details}</Text>
    {!!report.adminResponse && <View style={{ backgroundColor: colors.mintSurface, padding: 14, gap: 6, borderRadius: 14 }}><Label strong>Admin response</Label><Label>{report.adminResponse}</Label></View>}
    {admin && <>
      <Label strong>Review report</Label>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{(Object.keys(REPORT_STATUSES) as ReportStatus[]).map(value => <TouchableOpacity key={value} accessibilityRole="radio" accessibilityLabel={REPORT_STATUSES[value]} accessibilityState={{ checked: status === value, disabled: busy }} disabled={busy} onPress={() => setStatus(value)} style={{ minHeight: 44, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: status === value ? colors.primaryLight : colors.border, backgroundColor: status === value ? colors.mintSurface : colors.card }}><Text style={{ color: colors.text }}>{REPORT_STATUSES[value]}</Text></TouchableOpacity>)}</View>
      <Label>This response will be visible to the passenger.</Label>
      <TextInput accessibilityLabel="Response to passenger" value={response} onChangeText={setResponse} editable={!busy} multiline maxLength={2000} placeholder="Enter the review outcome or next steps" placeholderTextColor={colors.textTertiary} textAlignVertical="top" style={{ minHeight: 100, borderWidth: 1, borderRadius: 14, borderColor: colors.border, color: colors.text, padding: 14, fontSize: 15 }} />
      <Action title={busy ? 'Saving…' : 'Save review'} disabled={busy || response.trim().length < 3 || status === report.status && response.trim() === report.adminResponse} onPress={() => { void save(); }} />
    </>}
  </Card>;
}

export default function DriverReports({ admin = false }: { admin?: boolean }) {
  const [reports, setReports] = useState<DriverReport[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const request = useRef(0);
  const load = useCallback(async (next?: string) => {
    const sequence = ++request.current;
    setLoading(true); setError('');
    try {
      const page = await getReports(next ? 'cursor=' + encodeURIComponent(next) : '', admin);
      if (sequence !== request.current) return;
      setReports(previous => next ? [...previous, ...page.reports.filter(row => !previous.some(existing => existing.id === row.id))] : page.reports);
      setCursor(page.nextCursor);
    } catch (e) { if (sequence === request.current) setError(e instanceof Error ? e.message : 'Unable to load reports'); }
    finally { if (sequence === request.current) setLoading(false); }
  }, [admin]);
  useFocusEffect(useCallback(() => { void load(); return () => { request.current++; }; }, [load]));
  return <>
    <Label>{admin ? 'Review passenger complaints and send an update. Reports do not automatically change driver approval.' : 'Reports you submit from booking details appear here, along with admin responses.'}</Label>
    <Action title="Refresh reports" secondary disabled={loading} onPress={() => { void load(); }} />
    {loading && <Loading />}
    {!!error && <Card><Label>{error}</Label><Action title="Retry reports" disabled={loading} onPress={() => { void load(); }} /></Card>}
    {!loading && !error && !reports.length && <Card><Label strong>No reports yet</Label><Label>{admin ? 'Passenger reports will appear here.' : 'To report a driver, open Trips → View details → Report driver.'}</Label></Card>}
    {reports.map(report => <ReportCard key={report.id + ':' + (report.updatedAt || '')} report={report} admin={admin} onUpdated={() => { void load(); }} />)}
    {!!cursor && <Action title="Load older reports" secondary disabled={loading} onPress={() => { void load(cursor); }} />}
  </>;
}
