import { useTheme } from '@/src/store/theme';
import { useState } from 'react';
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@/src/components/ui/Input';
import DotLoader from '@/src/components/ui/DotLoader';
import { signup } from '@/src/auth/auth.service';
import { scale, verticalScale, moderateScale } from '@/src/utils/responsive';
import { showError, showSuccess } from '@/src/utils/toast';
import { useTranslation } from 'react-i18next';

export default function SignupScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const validate = () => {
    const newErrors: Record<string, string | undefined> = {};
    if (!fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Enter a valid email';
    if (!phone.trim()) newErrors.phone = 'Phone number is required';
    else if (phone.replace(/\D/g, '').length < 10) newErrors.phone = 'Enter a valid phone number';
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 8) newErrors.password = 'At least 8 characters';
    if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    if (!agreedToTerms) newErrors.terms = 'You must agree to the Terms of Service';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await signup(fullName, email, phone, password, 'passenger');
      showSuccess('OTP sent!', 'Check your email for the verification code.');
      setTransitioning(true);
      setTimeout(() => router.push({ pathname: '/(auth)/verify-otp', params: { email } }), 800);
    } catch (err: any) {
      showError('Signup failed', err.message);
      setErrors({ email: err.message });
    } finally { setLoading(false); }
  };

  const clearError = (field: string) => setErrors((e) => ({ ...e, [field]: undefined }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: scale(24) }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(auth)/login')} style={{ width: scale(44), height: scale(44), justifyContent: 'center', alignItems: 'center', marginTop: verticalScale(8) }}>
            <View style={{ width: scale(40), height: scale(40), borderRadius: scale(20), backgroundColor: colors.mintSurface, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="arrow-back" size={moderateScale(22)} color={colors.text} />
            </View>
          </TouchableOpacity>

          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ fontSize: moderateScale(28), fontWeight: '800', textAlign: 'center', color: colors.text, marginBottom: verticalScale(6) }}>{t('auth.passengerAccountTitle')}</Text>
            <Text style={{ fontSize: moderateScale(15), textAlign: 'center', color: colors.textTertiary, marginBottom: verticalScale(32), lineHeight: moderateScale(22) }}>{t('auth.passengerSignupSubtitle')}</Text>

            <Input label="Full Name" placeholder="Juan Dela Cruz" value={fullName} onChangeText={(t) => { setFullName(t); clearError('fullName'); }} icon="person-outline" error={errors.fullName} autoCapitalize="words" />
            <Input label="Email" placeholder="juan@email.com" value={email} onChangeText={(t) => { setEmail(t); clearError('email'); }} keyboardType="email-address" icon="mail-outline" error={errors.email} />
            <Input label="Phone Number" placeholder="+63 9XX XXX XXXX" value={phone} onChangeText={(t) => { setPhone(t); clearError('phone'); }} keyboardType="phone-pad" icon="phone-portrait-outline" error={errors.phone} />
            <Input label="Password" placeholder="Create a password" value={password} onChangeText={(t) => { setPassword(t); clearError('password'); }} secureTextEntry icon="lock-closed-outline" error={errors.password} />
            <Input label="Confirm Password" placeholder="Confirm your password" value={confirmPassword} onChangeText={(t) => { setConfirmPassword(t); clearError('confirmPassword'); }} secureTextEntry icon="lock-closed-outline" error={errors.confirmPassword} />

            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: verticalScale(4), marginBottom: verticalScale(24) }}
              onPress={() => { setAgreedToTerms(!agreedToTerms); setErrors((e) => ({ ...e, terms: undefined })); }} activeOpacity={0.7}>
              <View style={{ width: scale(20), height: scale(20), borderRadius: scale(6), marginTop: scale(2), marginRight: scale(10), justifyContent: 'center', alignItems: 'center',
                backgroundColor: agreedToTerms ? colors.primary : colors.mintSurface, borderWidth: agreedToTerms ? 0 : 1, borderColor: colors.border }}>
                {agreedToTerms && <Ionicons name="checkmark" size={moderateScale(14)} color="#fff" />}
              </View>
              <Text style={{ flex: 1, fontSize: moderateScale(13), lineHeight: moderateScale(20), color: colors.textTertiary }}>
                I agree to the <Text style={{ color: colors.primaryLight, fontWeight: '600' }}>Terms of Service</Text> and <Text style={{ color: colors.primaryLight, fontWeight: '600' }}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>
            {errors.terms && <Text style={{ fontSize: moderateScale(12), color: '#C0392B', marginTop: verticalScale(-16), marginBottom: verticalScale(16), marginLeft: scale(4) }}>{errors.terms}</Text>}

            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('auth.createPassengerAccount')} onPress={handleSignup} disabled={loading} activeOpacity={0.85}
              style={{ width: '100%', height: verticalScale(54), borderRadius: scale(16), justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontSize: moderateScale(16), fontWeight: '700', color: '#fff' }}>{t('auth.createPassengerAccount')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Register as driver" disabled={loading}
              onPress={() => router.push('/driver-register')} activeOpacity={0.85}
              style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12), borderWidth: 1, borderColor: colors.border, backgroundColor: colors.mintSurface, borderRadius: scale(16), padding: scale(16), marginTop: verticalScale(16) }}>
              <Ionicons name="bus-outline" size={moderateScale(24)} color={colors.primaryLight} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: moderateScale(15), fontWeight: '700', color: colors.primaryLight }}>Register as driver</Text>
                <Text style={{ fontSize: moderateScale(13), color: colors.textSecondary, marginTop: verticalScale(4) }}>Apply to drive a jeepney. Bus registration coming soon.</Text>
              </View>
              <Ionicons name="chevron-forward" size={moderateScale(20)} color={colors.primaryLight} />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: verticalScale(24) }}>
            <Text style={{ fontSize: moderateScale(14), color: colors.textTertiary }}>Already have an account?{' '}</Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}><Text style={{ fontSize: moderateScale(14), fontWeight: '700', color: colors.primaryLight }}>Sign In</Text></TouchableOpacity>
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
