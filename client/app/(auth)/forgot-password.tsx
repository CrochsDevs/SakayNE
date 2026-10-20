import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@/src/components/ui/Input';
import { forgotPassword, resetPassword } from '@/src/auth/auth.service';
import { scale, verticalScale, moderateScale } from '@/src/utils/responsive';
import { showError, showSuccess } from '@/src/utils/toast';
import { useTranslation } from 'react-i18next';

const EXPIRY_SECONDS = 300;

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'email' | 'otp' | 'reset'>('email');
  const [loading, setLoading] = useState(false);
  const [, setTransitioning] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(EXPIRY_SECONDS);
  const otpRef = useRef<TextInput>(null);

  useEffect(() => {
    if (step === 'otp') {
      const timer = setInterval(() => { setTimeLeft((prev) => { if (prev <= 1) { clearInterval(timer); return 0; } return prev - 1; }); }, 1000);
      return () => clearInterval(timer);
    }
  }, [step]);

  useEffect(() => { if (step === 'otp') setTimeout(() => otpRef.current?.focus(), 200); }, [step]);

  const handleSendOTP = async () => {
    if (!email.trim()) { setError('Enter your email'); return; }
    setLoading(true); setError('');
    try { await forgotPassword(email); showSuccess('OTP sent!', 'Check your email for the reset code.'); setStep('otp'); setTimeLeft(EXPIRY_SECONDS); }
    catch (err: any) { setError(err.message); showError('Failed', err.message); }
    finally { setLoading(false); }
  };

  const handleVerifyOTP = () => {
    if (otp.length !== 6) { setError('Enter the 6-digit code'); return; }
    setStep('reset'); setError('');
  };

  const handleReset = async () => {
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true); setError('');
    try { await resetPassword(email, otp, newPassword); setTransitioning(true); setTimeout(() => { router.replace('/(auth)/login'); showSuccess('Password reset!', 'You can now sign in with your new password.'); }, 800); }
    catch (err: any) { setError(err.message); showError('Reset failed', err.message); }
    finally { setLoading(false); }
  };

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
            <Image source={require('../../assets/logo/SakayNE.png')} style={{ width: scale(150), height: scale(150), alignSelf: 'center' }} resizeMode="contain" />

            {step === 'email' && (
              <>
                <Text style={{ fontSize: moderateScale(24), fontWeight: '800', color: '#0D1F16', textAlign: 'center', marginBottom: verticalScale(8) }}>{t('auth.forgotTitle')}</Text>
                <Text style={{ fontSize: moderateScale(14), color: '#8FA092', textAlign: 'center', marginBottom: verticalScale(32), lineHeight: moderateScale(20) }}>{t('auth.forgotSubtitle')}</Text>
                <Input label="Email" placeholder="Enter your email" value={email} onChangeText={(t) => { setEmail(t); setError(''); }} keyboardType="email-address" icon="mail-outline" error={error} />
                <TouchableOpacity onPress={handleSendOTP} disabled={loading} activeOpacity={0.85}
                  style={{ width: '100%', height: verticalScale(54), borderRadius: scale(16), justifyContent: 'center', alignItems: 'center', backgroundColor: '#3F8451', opacity: loading ? 0.7 : 1, marginTop: verticalScale(16) }}>
                  {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontSize: moderateScale(16), fontWeight: '700', color: '#fff' }}>{t('auth.sendCode')}</Text>}
                </TouchableOpacity>
              </>
            )}

            {step === 'otp' && (
              <>
                <Text style={{ fontSize: moderateScale(24), fontWeight: '800', color: '#0D1F16', textAlign: 'center', marginBottom: verticalScale(8) }}>{t('auth.enterCodeTitle')}</Text>
                <Text style={{ fontSize: moderateScale(14), color: '#8FA092', textAlign: 'center', marginBottom: verticalScale(32), lineHeight: moderateScale(20) }}>
                  {t('auth.enterCodeSubtitle')}{'\n'}<Text style={{ fontWeight: '600', color: '#0D1F16' }}>{email}</Text>
                </Text>
                <TextInput ref={otpRef} value={otp} onChangeText={(t) => { setOtp(t.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); }}
                  keyboardType="number-pad" maxLength={6} placeholder="000000" placeholderTextColor="#D6E4D8"
                  style={{ width: '100%', height: verticalScale(64), borderRadius: scale(16), backgroundColor: '#F5F7F5', fontSize: moderateScale(28), fontWeight: '700', textAlign: 'center', color: '#0D1F16', letterSpacing: scale(28), marginBottom: verticalScale(12) }} />
                <Text style={{ fontSize: moderateScale(13), color: timeLeft === 0 ? '#C0392B' : '#8FA092', textAlign: 'center', marginBottom: verticalScale(24) }}>
                  {timeLeft === 0 ? t('auth.codeExpired') : `${t('auth.codeExpiresIn')} ${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`}
                </Text>
                {error ? <Text style={{ fontSize: moderateScale(13), color: '#C0392B', textAlign: 'center', marginBottom: verticalScale(16) }}>{error}</Text> : null}
                <TouchableOpacity onPress={handleVerifyOTP} disabled={timeLeft === 0} activeOpacity={0.85}
                  style={{ width: '100%', height: verticalScale(54), borderRadius: scale(16), justifyContent: 'center', alignItems: 'center', backgroundColor: timeLeft === 0 ? '#D6E4D8' : '#3F8451' }}>
                  <Text style={{ fontSize: moderateScale(16), fontWeight: '700', color: '#fff' }}>{t('common.next')}</Text>
                </TouchableOpacity>
                {timeLeft === 0 && (
                  <TouchableOpacity onPress={handleSendOTP} disabled={loading} style={{ alignItems: 'center', marginTop: verticalScale(20) }}>
                    {loading ? <ActivityIndicator color="#3F8451" size="small" /> : <Text style={{ fontSize: moderateScale(14), color: '#3F8451', fontWeight: '600' }}>{t('auth.resendCode')}</Text>}
                  </TouchableOpacity>
                )}
              </>
            )}

            {step === 'reset' && (
              <>
                <Text style={{ fontSize: moderateScale(24), fontWeight: '800', color: '#0D1F16', textAlign: 'center', marginBottom: verticalScale(8) }}>{t('auth.newPasswordTitle')}</Text>
                <Text style={{ fontSize: moderateScale(14), color: '#8FA092', textAlign: 'center', marginBottom: verticalScale(32), lineHeight: moderateScale(20) }}>{t('auth.newPasswordSubtitle')}</Text>
                <Input label={t('auth.newPassword')} placeholder="At least 6 characters" value={newPassword} onChangeText={(tt) => { setNewPassword(tt); setError(''); }} secureTextEntry icon="lock-closed-outline" error={error} />
                <TouchableOpacity onPress={handleReset} disabled={loading} activeOpacity={0.85}
                  style={{ width: '100%', height: verticalScale(54), borderRadius: scale(16), justifyContent: 'center', alignItems: 'center', backgroundColor: '#3F8451', opacity: loading ? 0.7 : 1, marginTop: verticalScale(16) }}>
                  {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontSize: moderateScale(16), fontWeight: '700', color: '#fff' }}>{t('auth.resetPassword')}</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
