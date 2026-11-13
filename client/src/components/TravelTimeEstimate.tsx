import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/store/theme';
import { useInterfaceText } from '@/src/i18n/useInterfaceText';

export default function TravelTimeEstimate({ minutes, compact = false, historical = false, inline = false, summary = false }: { minutes: number; compact?: boolean; historical?: boolean; inline?: boolean; summary?: boolean }) {
  const { colors } = useTheme();
  const translate = useInterfaceText();
  const known = Number.isFinite(minutes) && minutes > 0;
  const rounded = known ? Math.ceil(minutes) : 0;
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  const duration = !known ? translate('Estimate unavailable') : hours > 0
    ? remainder ? translate('~{{hours}} hr {{minutes}} min', { hours, minutes: remainder }) : translate('~{{count}} hr', { count: hours })
    : translate('~{{count}} min', { count: rounded });
  if (inline) return <View testID="travel-time-estimate" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 26 }}><Ionicons name="time-outline" size={18} color={colors.primaryLight} /><Text style={{ flex: 1, color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>{translate(historical ? 'Planned travel time' : 'Estimated travel time')}</Text><Text style={{ color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '800', flexShrink: 1 }}>{duration}</Text></View>;
  return <View testID="travel-time-estimate" style={{ borderRadius: compact ? 15 : 22, padding: compact ? 13 : 18, backgroundColor: colors.mintSurface, gap: 11 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: compact ? 9 : 13 }}>
      <Ionicons name="time-outline" size={compact ? 21 : 34} color={colors.primaryLight} />
      <View style={{ flex: 1, minWidth: compact ? 95 : 130, gap: 4 }}><Text style={{ color: colors.primaryLight, fontSize: compact ? 11 : 12, lineHeight: 17, fontWeight: '700' }}>{translate(historical ? 'Planned travel time' : 'Estimated travel time')}</Text><Text style={{ color: colors.text, fontSize: compact ? 20 : 32, lineHeight: compact ? 27 : 40, fontWeight: '800', letterSpacing: -0.6 }}>{duration}</Text></View>
    </View>
    {!compact && <View style={{ gap: 5 }}><Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 19 }}>{translate(summary ? 'Pickup to drop-off · Excludes pickup waiting time' : 'From pickup to drop-off. Pickup waiting time is separate.')}</Text>{!summary && <Text style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 17 }}>{translate('Based on the route plan. Traffic and stops can change the travel time.')}</Text>}</View>}
  </View>;
}
