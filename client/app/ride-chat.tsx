import { useInterfaceText } from '@/src/i18n/useInterfaceText';
import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Avatar from '@/src/components/ui/Avatar';
import { apiRequest } from '@/src/config/api';
import { usePolling } from '@/src/ride/usePolling';
import { useTheme } from '@/src/store/theme';
import { showError } from '@/src/utils/toast';
import { getCurrentUser } from '@/src/auth/auth.service';
import { getRide, isActiveRide } from '@/src/ride/ride.store';

interface Message { _id: string; text: string; mine: boolean; role: string; createdAt: string; }
export default function RideChat() {
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const { colors } = useTheme();
  const translate = useInterfaceText();
  const accent = colors.primaryLight;
  const list = useRef<FlatList<Message>>(null);
  const nearBottom = useRef(true);
  const sending = useRef(false);
  const { data, error, loading, refresh } = usePolling(async () => {
    if (!rideId) throw new Error(translate("Choose a booking from Messages first."));
    const [ride, response, user] = await Promise.all([
      getRide(rideId), apiRequest<{ messages: Message[] }>('/rides/' + rideId + '/messages'), getCurrentUser(),
    ]);
    const isDriver = user?.role === 'driver';
    return { ride, messages: response.messages, isDriver, name: isDriver ? ride.passengerName || translate("Passenger") : ride.driverName || translate("Driver") };
  }, null as { ride: Awaited<ReturnType<typeof getRide>>; messages: Message[]; name: string; isDriver: boolean } | null, 3000);
  const canSend = !!data && isActiveRide(data.ride) && !error;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!text.trim() || sending.current || !canSend) return;
    sending.current = true;
    setBusy(true);
    try {
      await apiRequest('/rides/' + rideId + '/messages', { method: 'POST', body: JSON.stringify({ text: text.trim() }) });
      setText('');
      nearBottom.current = true;
      await refresh();
    } catch (e) { showError(e instanceof Error ? e.message : 'Message failed'); }
    finally { sending.current = false; setBusy(false); }
  };

  return <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}>
      <View style={[styles.header, { borderColor: colors.borderLight }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate("Go back to messages")} onPress={() => router.canGoBack() ? router.back() : router.replace('/messages')} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={26} color={accent} />
        </TouchableOpacity>
        <Avatar name={data?.name || ''} size={42} />
        <View style={styles.headerText}>
          <Text accessibilityRole="header" numberOfLines={1} style={[styles.name, { color: colors.text }]}>{data?.name || translate("Booking chat")}</Text>
          <Text style={[styles.caption, { color: colors.textSecondary }]}>{data ? `${data.isDriver ? translate("Passenger") : translate("Driver")} · ${isActiveRide(data.ride) ? translate("Booking chat") : translate("Booking ended")}` : translate("Loading conversation…")}</Text>
        </View>
      </View>
      {data && <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate("View this booking")} onPress={() => router.push({ pathname: data.isDriver ? '/driver-trip' : '/ride-tracking', params: { rideId: data.ride.id } })}
        style={[styles.route, { backgroundColor: colors.mintSurface }]}>
        <Ionicons name="bus-outline" size={19} color={accent} />
        <Text numberOfLines={1} style={[styles.routeText, { color: colors.text }]}>{data.ride.fromName} → {data.ride.toName}</Text>
        <Ionicons name="chevron-forward" size={18} color={accent} />
      </TouchableOpacity>}
      {!!error && <View style={[styles.error, { backgroundColor: colors.backgroundAlt }]}>
        <Text style={{ color: colors.error, flex: 1, fontSize: 15 }}>{error}</Text>
        <TouchableOpacity accessibilityRole="button" onPress={refresh} style={styles.iconButton}><Text style={{ color: accent, fontWeight: '700' }}>{translate("Retry")}</Text></TouchableOpacity>
      </View>}
      <FlatList ref={list} data={data?.messages || []} keyExtractor={message => message._id} style={styles.history}
        contentContainerStyle={styles.historyContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        onScroll={event => { const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent; nearBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 100; }} scrollEventThrottle={100}
        onLayout={() => { if (nearBottom.current) list.current?.scrollToEnd({ animated: false }); }}
        onContentSizeChange={() => { if (nearBottom.current) list.current?.scrollToEnd({ animated: false }); }}
        ListEmptyComponent={<View style={styles.empty}>
          {loading ? <ActivityIndicator color={accent} /> : data && <>
            <Avatar name={data.name} size={72} />
            <Text style={[styles.emptyName, { color: colors.text }]}>{data.name}</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{translate("No messages yet. Say hello and arrange your boarding place.")}</Text>
          </>}
        </View>}
        renderItem={({ item: message, index }) => {
          const previous = data?.messages[index - 1];
          const newDay = !previous || new Date(previous.createdAt).toDateString() !== new Date(message.createdAt).toDateString();
          return <View>
            {newDay && <Text style={[styles.day, { color: colors.textSecondary }]}>{new Date(message.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>}
            <View style={[styles.messageRow, { justifyContent: message.mine ? 'flex-end' : 'flex-start' }]}>
              {!message.mine && <Avatar name={data?.name || ''} size={28} />}
              <View style={styles.messageColumn}>
                <View style={[styles.bubble, message.mine ? styles.outgoing : styles.incoming, { backgroundColor: message.mine ? colors.primary : colors.backgroundAlt }]}>
                  <Text selectable style={[styles.messageText, { color: message.mine ? '#FFFFFF' : colors.text }]}>{message.text}</Text>
                </View>
                <Text style={[styles.time, { color: colors.textSecondary, textAlign: message.mine ? 'right' : 'left' }]}>{new Date(message.createdAt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</Text>
              </View>
            </View>
          </View>;
        }} />
      {data && !isActiveRide(data.ride) ? <View style={[styles.closed, { backgroundColor: colors.backgroundAlt }]}>
        <Ionicons name="lock-closed-outline" size={19} color={colors.textSecondary} />
        <Text style={[styles.closedText, { color: colors.textSecondary }]}>{translate("Booking ended. You can still read this conversation.")}</Text>
      </View> : <View style={[styles.composer, { borderColor: colors.borderLight, backgroundColor: colors.background }]}>
        <TextInput accessibilityLabel={translate("Booking message")} value={text} onChangeText={setText} editable={!busy && canSend} placeholder={translate("Message…")} placeholderTextColor={colors.textSecondary} maxLength={1000} multiline
          style={[styles.input, { backgroundColor: colors.backgroundAlt, color: colors.text }]} />
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate("Send message")} accessibilityState={{ disabled: busy || !text.trim() || !canSend, busy }} disabled={busy || !text.trim() || !canSend} onPress={() => { void send(); }}
          style={[styles.send, { backgroundColor: colors.mintSurface, opacity: busy || !text.trim() || !canSend ? 0.45 : 1 }]}>
          {busy ? <ActivityIndicator color={accent} /> : <Ionicons name="send" size={24} color={accent} />}
        </TouchableOpacity>
      </View>}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: 1 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, headerText: { flex: 1, minWidth: 0, paddingRight: 12 },
  name: { fontSize: 18, fontWeight: '700' }, caption: { fontSize: 13, marginTop: 4 }, route: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, gap: 10, minHeight: 48 },
  routeText: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 20 }, history: { flex: 1 }, historyContent: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 16 },
  day: { fontSize: 12, textAlign: 'center', paddingVertical: 22, fontWeight: '600' }, messageRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 8 },
  messageColumn: { maxWidth: '80%', flexShrink: 1 }, bubble: { borderRadius: 20, paddingHorizontal: 15, paddingVertical: 11 }, outgoing: { borderBottomRightRadius: 5 }, incoming: { borderBottomLeftRadius: 5 },
  messageText: { fontSize: 17, lineHeight: 25 }, time: { fontSize: 11, paddingHorizontal: 6, marginTop: 4 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1 },
  input: { flex: 1, minWidth: 0, minHeight: 48, maxHeight: 120, borderRadius: 24, paddingHorizontal: 18, paddingTop: 13, paddingBottom: 13, fontSize: 17, lineHeight: 23 },
  send: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 14 },
  emptyName: { fontSize: 22, fontWeight: '700', textAlign: 'center' }, emptyText: { fontSize: 16, lineHeight: 24, textAlign: 'center' },
  error: { paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }, closed: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 18 }, closedText: { flex: 1, fontSize: 15, lineHeight: 22 },
});
