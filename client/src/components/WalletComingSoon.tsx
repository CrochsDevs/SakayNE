import { useInterfaceText } from '@/src/i18n/useInterfaceText';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/src/store/theme';

export default function WalletComingSoon({ homeRoute = '/(passenger)/home' }: { homeRoute?: '/(passenger)/home' | '/(driver)' }) {
  const { colors } = useTheme();
  const translate = useInterfaceText();
  const returnLabel = translate('Back to Home');
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.heading, { color: colors.text }]}>{translate("Wallet")}</Text>
      <View style={styles.placeholder}>
        <View style={[styles.icon, { backgroundColor: colors.mintSurface }]}><Ionicons name="wallet-outline" size={46} color={colors.primaryLight} /></View>
        <View style={[styles.badge, { backgroundColor: colors.accentSurface }]}><Ionicons name="sparkles" size={13} color={colors.onAccent} /><Text style={{ color: colors.onAccent, fontSize: 11, fontWeight: '700' }}>{translate("Something to look forward to")}</Text></View>
        <Text style={[styles.title, { color: colors.text }]}>{translate("Coming soon")}</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>{translate("We’re getting your Sakay wallet ready. Check back soon!")}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={returnLabel} onPress={() => router.navigate(homeRoute)} style={[styles.button, { backgroundColor: colors.primary }]}><Text style={{ color: colors.onPrimary, fontSize: 15, fontWeight: '700' }}>{returnLabel}</Text><Ionicons name="arrow-forward" size={18} color={colors.onPrimary} /></TouchableOpacity>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, width: '100%', maxWidth: 600, alignSelf: 'center', padding: 24 },
  heading: { fontSize: 29, fontWeight: '900', letterSpacing: -0.8, marginTop: 6 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 36 },
  icon: { width: 100, height: 100, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 24, transform: [{ rotate: '-6deg' }] },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16 },
  title: { fontSize: 30, fontWeight: '900', letterSpacing: -0.8 },
  description: { fontSize: 14, lineHeight: 23, maxWidth: 270, textAlign: 'center', marginTop: 10 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 50, paddingHorizontal: 24, borderRadius: 16, marginTop: 28 },
});
