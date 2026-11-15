import { useInterfaceText } from '@/src/i18n/useInterfaceText';
import { router } from 'expo-router';
import { Text, TouchableOpacity, View, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/src/store/theme';
import CommuteScene from '@/src/components/ui/CommuteScene';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const { colors, brand: Brand } = useTheme();
  const translate = useInterfaceText();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = height - insets.top - insets.bottom < 740;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', width: '100%', maxWidth: 440, alignSelf: 'center', padding: compact ? 18 : 24, paddingBottom: compact ? 12 : 20 }}>
      <LinearGradient colors={[colors.heroStart, colors.heroEnd]} style={{ borderRadius: 28, padding: compact ? 18 : 22, paddingBottom: 8, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.accentSurface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 }}><Ionicons name="sunny" size={13} color={colors.heroText} /><Text style={{ fontSize: 10, fontWeight: '800', color: colors.heroText, letterSpacing: 1 }}>HELLO, NUEVA ECIJA</Text></View>
        <Text style={{ fontSize: compact ? 32 : 38, lineHeight: compact ? 36 : 42, letterSpacing: -1.5, fontWeight: '900', color: colors.heroText, marginTop: 12 }}>{translate("Good days.")}{ "\n" }{translate("Great rides.")}</Text>
        <Text style={{ color: colors.heroSubtext, fontSize: compact ? 13 : 14, lineHeight: 20, marginTop: 8, maxWidth: 260 }}>{translate("Your everyday commute, with a little more ease. Tara, biyahe na!")}</Text>
        <View style={{ marginTop: 10 }}><CommuteScene compact /></View>
      </LinearGradient>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: compact ? 12 : 18, paddingVertical: compact ? 12 : 18, flexWrap: 'wrap' }}>
        {([translate("Local rides"), translate("Easy booking"), translate("Your way")] as const).map((label, index) => <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Ionicons name={index === 0 ? 'location' : index === 1 ? 'ticket' : 'heart'} size={13} color={index === 2 ? Brand.coral : colors.primaryLight} /><Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>{label}</Text></View>)}
      </View>
      <View style={{ marginTop: compact ? 8 : 12, gap: 8 }}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('auth.passengerSignup')} onPress={() => router.push('/(auth)/signup')} activeOpacity={0.85} style={{ minHeight: 56, borderRadius: 18, backgroundColor: Brand.teal, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 }}><Text style={{ fontSize: 16, fontWeight: '800', color: '#FFFFFF' }}>{t('auth.passengerSignup')}</Text><Ionicons name="arrow-forward" size={20} color={Brand.sunshine} /></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate("Register as driver")} onPress={() => router.push('/driver-register')} style={{ minHeight: 54, borderRadius: 18, backgroundColor: colors.mintSurface, padding: 16, alignItems: 'center' }}><Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{translate("Register as driver")}</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="I already have an account" onPress={() => router.push('/(auth)/login')} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('auth.hasAccount')}{' '}<Text style={{ color: colors.primaryLight, fontWeight: '800' }}>{translate("Sign in")}</Text></Text></TouchableOpacity>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
