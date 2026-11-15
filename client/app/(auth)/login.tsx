import BrandMark from '@/src/components/ui/BrandMark';
import { useTheme } from '@/src/store/theme';
import { useState, useSyncExternalStore } from 'react';
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@/src/components/ui/Input';
import DotLoader from '@/src/components/ui/DotLoader';
import { login } from '@/src/auth/auth.service';
import { scale, verticalScale, moderateScale } from '@/src/utils/responsive';
import { showError } from '@/src/utils/toast';
import { useTranslation } from 'react-i18next';

const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

function isEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value);
}

function isPhone(value: string) {
  return /^[\d\s+\-()]+$/.test(value) && value.replace(/\D/g, '').length >= 10;
}

export default function LoginScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const hydrated = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
  const { email, registration } = useLocalSearchParams<{ email?: string; registration?: string }>();
  const [identifier, setIdentifier] = useState(typeof email === 'string' ? email.trim().toLowerCase() : '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const validate = () => {
    const newErrors: Record<string, string | undefined> = {};
    if (!identifier.trim()) {
      newErrors.identifier = 'Email or phone number is required';
    } else if (!isEmail(identifier) && !isPhone(identifier)) {
      newErrors.identifier = 'Enter a valid email or PH number';
    }
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const data = await login(identifier, password);
      setTransitioning(true);
      const route = data.user?.role === 'driver' ? '/(driver)' : data.user?.role === 'admin' ? '/admin' : '/(passenger)/home';
      setTimeout(() => router.replace(route), 800);
    } catch (err: any) {
      showError('Login failed', err.message);
      setErrors({ password: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (!hydrated) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color={colors.primaryLight} /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: 24, paddingBottom: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace('/welcome')} style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginTop: 4 }}>
            <View style={{ width: scale(40), height: scale(40), borderRadius: scale(20), backgroundColor: colors.mintSurface, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="arrow-back" size={moderateScale(22)} color={colors.text} />
            </View>
          </TouchableOpacity>

          <View style={{ paddingTop: 4 }}>
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <BrandMark />
            </View>
            <Text style={{ fontSize: moderateScale(28), fontWeight: '800', textAlign: 'center', color: colors.text, marginBottom: verticalScale(6) }}>
              {t('auth.welcomeBack')}
            </Text>
            <Text style={{ fontSize: moderateScale(15), textAlign: 'center', color: colors.textTertiary, marginBottom: 20, lineHeight: moderateScale(22) }}>
              {t('auth.signInSubtitle')}
            </Text>

            <Input label={t('auth.email')} placeholder={t('auth.emailPlaceholder')} value={identifier}
              onChangeText={(text) => { setIdentifier(text); setErrors((e) => ({ ...e, identifier: undefined })); }}
              keyboardType="default" icon="person-outline" error={errors.identifier} />

            {registration === 'verified' && <Text style={{ fontSize: moderateScale(14), color: colors.primaryLight, marginBottom: verticalScale(16), lineHeight: moderateScale(20) }}>Email verified. Sign in with the password you created during registration.</Text>}

            <Input label={t('auth.password')} placeholder={t('auth.passwordPlaceholder')} value={password}
              onChangeText={(text) => { setPassword(text); setErrors((e) => ({ ...e, password: undefined })); }}
              secureTextEntry icon="lock-closed-outline" error={errors.password} />

            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('auth.forgotPassword')} onPress={() => router.push('/(auth)/forgot-password')} style={{ alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', marginTop: -8, marginBottom: 8 }}>
              <Text style={{ fontSize: moderateScale(14), fontWeight: '600', color: colors.primaryLight }}>{t('auth.forgotPassword')}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleLogin} disabled={loading} activeOpacity={0.85}
              accessibilityRole="button" accessibilityLabel={t('auth.signIn')}
              style={{ width: '100%', minHeight: 48, borderRadius: scale(16), justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontSize: moderateScale(16), fontWeight: '700', color: '#fff' }}>{t('auth.signIn')}</Text>}
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12 }}>
            <Text style={{ fontSize: moderateScale(14), color: colors.textTertiary }}>{t('auth.noAccount')}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('auth.passengerSignup')} disabled={loading}
            onPress={() => router.push('/(auth)/signup')} activeOpacity={0.85}
            style={{ flex: 1, minHeight: 48, padding: 8, justifyContent: 'center', alignItems: 'center', borderRadius: scale(16), backgroundColor: colors.mintSurface, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 13, textAlign: 'center', fontWeight: '700', color: colors.primaryLight }}>{t('auth.passengerSignup')}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Register as driver" disabled={loading}
            onPress={() => router.push('/driver-register')} activeOpacity={0.85}
            style={{ flex: 1, minHeight: 48, padding: 8, justifyContent: 'center', alignItems: 'center', borderRadius: scale(16), borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 13, textAlign: 'center', fontWeight: '700', color: colors.primaryLight }}>Register as driver</Text>
          </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {transitioning && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
          <DotLoader color={colors.primaryLight} size={12} />
        </View>
      )}
    </SafeAreaView>
  );
}
