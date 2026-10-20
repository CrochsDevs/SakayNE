import { PropsWithChildren } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/src/store/theme';
export function Screen({ title, children, back = false }: PropsWithChildren<{ title: string; back?: boolean }>) {
  const { colors } = useTheme();
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><ScrollView contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 48 }}>
    {back && <TouchableOpacity onPress={() => router.back()}><Text style={{ color: colors.primary }}>← Back</Text></TouchableOpacity>}
    <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text }}>{title}</Text>{children}
  </ScrollView></SafeAreaView>;
}
export function Card({ children }: PropsWithChildren) { const { colors } = useTheme(); return <View style={{ backgroundColor: colors.card, borderColor: colors.borderLight, borderWidth: 1, borderRadius: 18, padding: 18, gap: 10 }}>{children}</View>; }
export function Label({ children, strong = false }: PropsWithChildren<{ strong?: boolean }>) { const { colors } = useTheme(); return <Text style={{ color: strong ? colors.text : colors.textSecondary, fontSize: strong ? 17 : 14, fontWeight: strong ? '700' : '400', lineHeight: 22 }}>{children}</Text>; }
export function Action({ title, onPress, disabled = false, secondary = false }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  const { colors } = useTheme();
  return <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress} style={{ borderRadius: 12, padding: 15, backgroundColor: secondary ? colors.backgroundAlt : colors.primary, opacity: disabled ? 0.45 : 1, alignItems: 'center' }}><Text style={{ color: secondary ? colors.text : '#fff', fontWeight: '700' }}>{title}</Text></TouchableOpacity>;
}
export function Loading() { return <ActivityIndicator color="#3F8451" />; }
