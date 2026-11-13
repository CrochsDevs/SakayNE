import { PropsWithChildren } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/src/store/theme';
import { Ionicons } from '@expo/vector-icons';
import { useInterfaceText } from '@/src/i18n/useInterfaceText';

export function Screen({ title, children, back = false }: PropsWithChildren<{ title: string; back?: boolean }>) {
  const { colors, brand: Brand } = useTheme();
  const translate = useInterfaceText();
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', padding: 22, gap: 16, paddingBottom: 48 }}>
    {back && <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate("Go back")} onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', minHeight: 44, paddingRight: 14, paddingLeft: 10, borderRadius: 15, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}><Ionicons name="arrow-back" size={19} color={colors.text} /><Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{translate("Back")}</Text></TouchableOpacity>}
    <View style={{ marginTop: 6, marginBottom: 6, gap: 10 }}><Text style={{ fontSize: 29, lineHeight: 36, letterSpacing: -0.9, fontWeight: '900', color: colors.text }}>{title}</Text><View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: Brand.sunshine }} /></View>{children}
  </ScrollView></SafeAreaView>;
}
export function Card({ children }: PropsWithChildren) { const { colors } = useTheme(); return <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 24, padding: 20, gap: 12, boxShadow: '0 4px 18px rgba(15,61,66,0.035)' }}>{children}</View>; }
export function Label({ children, strong = false }: PropsWithChildren<{ strong?: boolean }>) { const { colors } = useTheme(); return <Text style={{ color: strong ? colors.text : colors.textSecondary, fontSize: strong ? 17 : 14, fontWeight: strong ? '700' : '400', lineHeight: 22 }}>{children}</Text>; }
export function Action({ title, onPress, disabled = false, secondary = false }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  const { colors } = useTheme();
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} activeOpacity={0.8} style={{ borderRadius: 16, padding: 15, minHeight: 50, borderWidth: 1, borderColor: secondary ? colors.border : 'transparent', backgroundColor: secondary ? colors.mintSurface : colors.primary, opacity: disabled ? 0.45 : 1, alignItems: 'center', justifyContent: 'center', flexShrink: 1 }}><Text style={{ color: secondary ? colors.text : colors.onPrimary, fontWeight: '700', fontSize: 14, textAlign: 'center' }}>{title}</Text></TouchableOpacity>;
}
export function Loading() { const { colors } = useTheme(); return <ActivityIndicator color={colors.primaryLight} />; }
