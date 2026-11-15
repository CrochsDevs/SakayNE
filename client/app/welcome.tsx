import { useInterfaceText } from '@/src/i18n/useInterfaceText';
import { router } from 'expo-router';
import { Image, Text, TouchableOpacity, View, ScrollView, useWindowDimensions } from 'react-native';
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
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.backgroundAlt }}>
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', width: '100%', maxWidth: 440, alignSelf: 'center', padding: compact ? 18 : 24, paddingBottom: compact ? 12 : 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: compact ? 14 : 18 }}>
        <View style={{ width: 148, height: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: colors.borderLight }}>
          <Image source={require('@/assets/logo/SakayNE.png')} accessibilityLabel="Sakay — For Every Juan" resizeMode="contain" style={{ width: 126, height: 46 }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 20, backgroundColor: colors.surface }}>
          <Ionicons name="navigate-outline" size={13} color={colors.primaryLight} />
          <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.6 }}>{translate("Local rides")}</Text>
        </View>
      </View>
      <LinearGradient colors={[colors.heroStart, colors.heroEnd]} style={{ borderRadius: 28, padding: compact ? 18 : 22, paddingBottom: 8, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.accentSurface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 }}>
          <Ionicons name="sunny" size={13} color={colors.heroText} />
          <Text style={{ fontSize: 10, fontWeight: '800', color: colors.heroText, letterSpacing: 1 }}>HELLO, NUEVA ECIJA</Text>
        </View>
        <Text style={{ fontSize: compact ? 32 : 38, lineHeight: compact ? 36 : 42, letterSpacing: -1.5, fontWeight: '900', color: colors.heroText, marginTop: 12 }}>
          {translate("Good days.")}{'\n'}{translate("Great rides.")}
        </Text>
        <Text style={{ color: colors.heroSubtext, fontSize: compact ? 13 : 14, lineHeight: 20, marginTop: 8, maxWidth: 260 }}>
          {translate("Your everyday commute, with a little more ease. Tara, biyahe na!")}
        </Text>
        <View style={{ marginTop: 10 }}><CommuteScene compact /></View>
      </LinearGradient>
      <View style={{ marginTop: compact ? 14 : 18, gap: 10 }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('auth.passengerSignup')}
          onPress={() => router.push('/(auth)/signup')}
          activeOpacity={0.88}
          style={{ minHeight: 68, borderRadius: 20, backgroundColor: Brand.teal, paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>{t('auth.passengerSignup')}</Text>
            <Text style={{ fontSize: 11, lineHeight: 16, color: '#D5F0E9', marginTop: 2 }}>{translate("Book your next ride across Nueva Ecija.")}</Text>
          </View>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Brand.deepTeal, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-forward" size={18} color={Brand.sunshine} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={translate("Register as driver")}
          onPress={() => router.push('/driver-register')}
          activeOpacity={0.82}
          style={{ minHeight: 68, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }}
        >
          <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.mintSurface, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <Ionicons name="car-outline" size={19} color={colors.primaryLight} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>{translate("Register as driver")}</Text>
            <Text style={{ fontSize: 11, lineHeight: 16, color: colors.textSecondary, marginTop: 2 }}>{translate("Set your schedule and drive with Sakay.")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="I already have an account" onPress={() => router.push('/(auth)/login')} style={{ minHeight: 42, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t('auth.hasAccount')}{' '}<Text style={{ color: colors.primaryLight, fontWeight: '800' }}>{translate("Sign in")}</Text></Text>
          </TouchableOpacity>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
