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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: scale(24) }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: scale(44), height: scale(44), justifyContent: 'center', alignItems: 'center', marginTop: verticalScale(8) }}>
            <View style={{ width: scale(40), height: scale(40), borderRadius: scale(20), backgroundColor: '#F5F7F5', justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="arrow-back" size={moderateScale(22)} color="#0D1F16" />
            </View>
          </TouchableOpacity>

          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ fontSize: moderateScale(28), fontWeight: '800', textAlign: 'center', color: '#0D1F16', marginBottom: verticalScale(6) }}>{t('auth.passengerAccountTitle')}</Text>
            <Text style={{ fontSize: moderateScale(15), textAlign: 'center', color: '#8FA092', marginBottom: verticalScale(32), lineHeight: moderateScale(22) }}>{t('auth.passengerSignupSubtitle')}</Text>

            <Input label="Full Name" placeholder="Juan Dela Cruz" value={fullName} onChangeText={(t) => { setFullName(t); clearError('fullName'); }} icon="person-outline" error={errors.fullName} autoCapitalize="words" />
            <Input label="Email" placeholder="juan@email.com" value={email} onChangeText={(t) => { setEmail(t); clearError('email'); }} keyboardType="email-address" icon="mail-outline" error={errors.email} />
            <Input label="Phone Number" placeholder="+63 9XX XXX XXXX" value={phone} onChangeText={(t) => { setPhone(t); clearError('phone'); }} keyboardType="phone-pad" icon="phone-portrait-outline" error={errors.phone} />
            <Input label="Password" placeholder="Create a password" value={password} onChangeText={(t) => { setPassword(t); clearError('password'); }} secureTextEntry icon="lock-closed-outline" error={errors.password} />
            <Input label="Confirm Password" placeholder="Confirm your password" value={confirmPassword} onChangeText={(t) => { setConfirmPassword(t); clearError('confirmPassword'); }} secureTextEntry icon="lock-closed-outline" error={errors.confirmPassword} />

            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: verticalScale(4), marginBottom: verticalScale(24) }}
              onPress={() => { setAgreedToTerms(!agreedToTerms); setErrors((e) => ({ ...e, terms: undefined })); }} activeOpacity={0.7}>
              <View style={{ width: scale(20), height: scale(20), borderRadius: scale(6), marginTop: scale(2), marginRight: scale(10), justifyContent: 'center', alignItems: 'center',
                backgroundColor: agreedToTerms ? '#3F8451' : '#F5F7F5', borderWidth: agreedToTerms ? 0 : 1, borderColor: '#D6E4D8' }}>
                {agreedToTerms && <Ionicons name="checkmark" size={moderateScale(14)} color="#fff" />}
              </View>
              <Text style={{ flex: 1, fontSize: moderateScale(13), lineHeight: moderateScale(20), color: '#8FA092' }}>
                I agree to the <Text style={{ color: '#3F8451', fontWeight: '600' }}>Terms of Service</Text> and <Text style={{ color: '#3F8451', fontWeight: '600' }}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>
            {errors.terms && <Text style={{ fontSize: moderateScale(12), color: '#C0392B', marginTop: verticalScale(-16), marginBottom: verticalScale(16), marginLeft: scale(4) }}>{errors.terms}</Text>}

            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('auth.createPassengerAccount')} onPress={handleSignup} disabled={loading} activeOpacity={0.85}
              style={{ width: '100%', height: verticalScale(54), borderRadius: scale(16), justifyContent: 'center', alignItems: 'center', backgroundColor: '#3F8451', opacity: loading ? 0.7 : 1 }}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontSize: moderateScale(16), fontWeight: '700', color: '#fff' }}>{t('auth.createPassengerAccount')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Register as driver" disabled={loading}
              onPress={() => router.push('/driver-register')} activeOpacity={0.85}
              style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12), borderWidth: 1, borderColor: '#D6E4D8', backgroundColor: '#F5F7F5', borderRadius: scale(16), padding: scale(16), marginTop: verticalScale(16) }}>
              <Ionicons name="bus-outline" size={moderateScale(24)} color="#3F8451" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: moderateScale(15), fontWeight: '700', color: '#3F8451' }}>Register as driver</Text>
                <Text style={{ fontSize: moderateScale(13), color: '#65796A', marginTop: verticalScale(4) }}>Apply to drive a bus or jeepney</Text>
              </View>
              <Ionicons name="chevron-forward" size={moderateScale(20)} color="#3F8451" />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: verticalScale(24) }}>
            <Text style={{ fontSize: moderateScale(14), color: '#8FA092' }}>Already have an account?{' '}</Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}><Text style={{ fontSize: moderateScale(14), fontWeight: '700', color: '#3F8451' }}>Sign In</Text></TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {transitioning && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
          <DotLoader color="#3F8451" size={12} />
        </View>
      )}
    </SafeAreaView>
  );
}
