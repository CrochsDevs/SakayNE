import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/store/theme';
import { useInterfaceText } from '@/src/i18n/useInterfaceText';

export default function PickupAccuracyNotice({ accuracy, forDriver = false }: { accuracy: number | null; forDriver?: boolean }) {
  const { colors } = useTheme();
  const translate = useInterfaceText();
  if (accuracy !== null && accuracy <= 100) return null;
  return <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 13, backgroundColor: colors.accentSurface }}>
    <Ionicons name="information-circle-outline" size={19} color={colors.onAccent} />
    <View style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.onAccent, fontSize: 12, lineHeight: 18, fontWeight: '700' }}>{accuracy === null ? translate('Approximate pickup location') : translate('Approximate pickup · ±{{count}} m', { count: Math.round(accuracy) })}</Text><Text style={{ color: colors.onAccent, fontSize: 12, lineHeight: 18 }}>{translate(forDriver ? 'Confirm the pickup spot with your passenger.' : 'You can continue. Confirm the pickup spot with your driver.')}</Text></View>
  </View>;
}
