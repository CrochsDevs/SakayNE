import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useTheme } from '@/src/store/theme';

export default function FeatureComingSoon({ title, description, icon, homeRoute = '/(passenger)/home', actionLabel = 'Back to Home' }: {
  title: string; description: string; icon: keyof typeof Ionicons.glyphMap; homeRoute?: Href; actionLabel?: string;
}) {
  const { colors } = useTheme();
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView contentContainerStyle={{ flexGrow: 1, width: '100%', maxWidth: 600, alignSelf: 'center', padding: 24 }}>
      <Text style={{ color: colors.text, fontSize: 29, fontWeight: '900', letterSpacing: -0.8, marginTop: 6 }}>{title}</Text>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 36 }}>
        <View style={{ width: 100, height: 100, borderRadius: 32, backgroundColor: colors.mintSurface, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}><Ionicons name={icon} size={46} color={colors.primaryLight} /></View>
        <View style={{ backgroundColor: colors.accentSurface, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginBottom: 16 }}><Ionicons name="sparkles" size={13} color={colors.onAccent} /><Text style={{ color: colors.onAccent, fontSize: 11, fontWeight: '700' }}>Something to look forward to</Text></View>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.8 }}>Coming soon</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 23, maxWidth: 290, textAlign: 'center', marginTop: 10 }}>{description}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={actionLabel} onPress={() => router.navigate(homeRoute)} style={{ backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 50, paddingHorizontal: 24, borderRadius: 16, marginTop: 28 }}><Text style={{ color: colors.onPrimary, fontSize: 15, fontWeight: '700' }}>{actionLabel}</Text><Ionicons name="arrow-forward" size={18} color={colors.onPrimary} /></TouchableOpacity>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
