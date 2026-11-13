import { useInterfaceText } from '@/src/i18n/useInterfaceText';
import { router } from 'expo-router';
import { Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/src/store/theme';
import BrandMark from '@/src/components/ui/BrandMark';
import CommuteScene from '@/src/components/ui/CommuteScene';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const { colors, brand: Brand } = useTheme();
  const translate = useInterfaceText();
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView contentContainerStyle={{ flexGrow: 1, width: '100%', maxWidth: 540, alignSelf: 'center', padding: 26, paddingBottom: 30 }}>
      <View style={{ marginTop: 12, marginBottom: 28 }}><BrandMark large /></View>
      <LinearGradient colors={[colors.heroStart, colors.heroEnd]} style={{ borderRadius: 32, padding: 24, paddingBottom: 12, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.accentSurface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 }}><Ionicons name="sunny" size={13} color={colors.heroText} /><Text style={{ fontSize: 10, fontWeight: '800', color: colors.heroText, letterSpacing: 1 }}>HELLO, NUEVA ECIJA</Text></View>
        <Text style={{ fontSize: 42, lineHeight: 46, letterSpacing: -2, fontWeight: '900', color: colors.heroText, marginTop: 20 }}>{translate("Good days.")}{ "\n" }{translate("Great rides.")}</Text>
        <Text style={{ color: colors.heroSubtext, fontSize: 14, lineHeight: 22, marginTop: 12, maxWidth: 240 }}>{translate("Your everyday commute, with a little more ease. Tara, biyahe na!")}</Text>
        <View style={{ marginTop: 20 }}><CommuteScene /></View>
      </LinearGradient>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18, paddingVertical: 22, flexWrap: 'wrap' }}>
        {([translate("Local rides"), translate("Easy booking"), translate("Your way")] as const).map((label, index) => <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Ionicons name={index === 0 ? 'location' : index === 1 ? 'ticket' : 'heart'} size={13} color={index === 2 ? Brand.coral : colors.primaryLight} /><Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>{label}</Text></View>)}
      </View>
      <View style={{ flex: 1, justifyContent: 'flex-end', gap: 12 }}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('auth.passengerSignup')} onPress={() => router.push('/(auth)/signup')} activeOpacity={0.85} style={{ minHeight: 56, borderRadius: 18, backgroundColor: Brand.teal, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 }}><Text style={{ fontSize: 16, fontWeight: '800', color: '#FFFFFF' }}>{t('auth.passengerSignup')}</Text><Ionicons name="arrow-forward" size={20} color={Brand.sunshine} /></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate("Register as driver")} onPress={() => router.push('/driver-register')} style={{ minHeight: 54, borderRadius: 18, backgroundColor: colors.mintSurface, padding: 16, alignItems: 'center' }}><Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{translate("Register as driver")}</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="I already have an account" onPress={() => router.push('/(auth)/login')} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.textSecondary, fontSize: 13 }}>{translate("Already a ka-biyahe? ")}<Text style={{ color: colors.primaryLight, fontWeight: '800' }}>{translate("Sign in")}</Text></Text></TouchableOpacity>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
