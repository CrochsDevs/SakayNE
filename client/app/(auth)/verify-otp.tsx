import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { resendVerification, verifyEmail } from '@/src/auth/auth.service';
import DotLoader from '@/src/components/ui/DotLoader';
import { scale, verticalScale, moderateScale } from '@/src/utils/responsive';
import { showError, showSuccess } from '@/src/utils/toast';
import { useTranslation } from 'react-i18next';

const EXPIRY_SECONDS = 300;

export default function VerifyOTPScreen() {
  const { t } = useTranslation();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const email = typeof emailParam === 'string' ? emailParam.trim().toLowerCase() : '';
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState(email ? '' : 'Start registration first so we know which email to verify.');
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const [expiresAt, setExpiresAt] = useState(() => Date.now() + EXPIRY_SECONDS * 1000);
  const [resendAfter, setResendAfter] = useState(() => Date.now() + 30000);
  const [timeLeft, setTimeLeft] = useState(EXPIRY_SECONDS);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const update = () => setTimeLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 200); }, []);

  const handleChange = (text: string) => { setCode(text.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); };
  const expired = timeLeft === 0;
  const resendWait = Math.max(0, Math.ceil((resendAfter - Date.now()) / 1000));
  const goToLogin = () => router.replace({ pathname: '/(auth)/login', params: { email, registration: 'verified' } });

  const handleVerify = async () => {
    if (!email || loading || alreadyVerified) return;
    if (expired) { setError('Code expired. Please request a new one.'); return; }
    if (code.length !== 6) { setError('Please enter the full 6-digit code'); return; }
    setLoading(true);
    try { await verifyEmail(email, code); setTransitioning(true); setTimeout(() => { goToLogin(); showSuccess('Email verified!', 'Sign in with the password you created.'); }, 800); }
    catch (err: any) { setError(err.message); setAlreadyVerified(err.code === 'ACCOUNT_ALREADY_VERIFIED'); showError('Verification failed', err.message); }
    finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (loading || resendWait || !email || alreadyVerified) return;
    setLoading(true);
    try {
      await resendVerification(email);
      showSuccess('Code resent!', 'A new code has been sent to your email.');
      setCode(''); setError(''); setTimeLeft(EXPIRY_SECONDS);
      setExpiresAt(Date.now() + EXPIRY_SECONDS * 1000); setResendAfter(Date.now() + 30000);
      setTimeout(() => inputRef.current?.focus(), 200);
    } catch (err: any) { setError(err.message); showError('Resend failed', err.message); }
    finally { setLoading(false); }
  };

  // Static HTML has no registration email/query parameters. Render the same
  // loading view on the server and first client render before showing them.
  if (!hydrated) return <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color="#3F8451" /></SafeAreaView>;

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
            <View style={{ alignItems: 'center', marginBottom: verticalScale(40) }}>
              <View style={{ width: scale(72), height: scale(72), borderRadius: scale(36), backgroundColor: '#F0F7F1', justifyContent: 'center', alignItems: 'center', marginBottom: verticalScale(24) }}>
                <Ionicons name="mail-outline" size={moderateScale(36)} color="#3F8451" />
              </View>
              <Text style={{ fontSize: moderateScale(24), fontWeight: '800', color: '#0D1F16', textAlign: 'center', marginBottom: verticalScale(8) }}>{t('auth.verifyEmail')}</Text>
              <Text style={{ fontSize: moderateScale(14), color: '#8FA092', textAlign: 'center', lineHeight: moderateScale(20) }}>
                {t('auth.verifySubtitle')}{'\n'}<Text style={{ fontWeight: '600', color: '#0D1F16' }}>{email}</Text>
              </Text>
            </View>

            <View style={{ marginBottom: verticalScale(24), paddingHorizontal: scale(4) }}>
              <TextInput ref={inputRef} value={code} onChangeText={handleChange} keyboardType="number-pad" maxLength={6} autoFocus
                accessibilityLabel="Email verification code" textContentType="oneTimeCode" autoComplete="one-time-code" editable={!loading && !alreadyVerified}
                placeholder="000000" placeholderTextColor="#D6E4D8"
                style={{ width: '100%', height: verticalScale(64), borderRadius: scale(16), backgroundColor: '#F5F7F5', fontSize: moderateScale(28), fontWeight: '700', textAlign: 'center', color: '#0D1F16', letterSpacing: scale(28) }} />
            </View>

            <Text style={{ fontSize: moderateScale(13), color: expired ? '#C0392B' : '#8FA092', textAlign: 'center', marginBottom: verticalScale(28) }}>
              {expired ? t('auth.codeExpired') : `${t('auth.codeExpiresIn')} ${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`}
            </Text>

            {error ? <Text style={{ fontSize: moderateScale(13), color: '#C0392B', textAlign: 'center', marginBottom: verticalScale(16) }}>{error}</Text> : null}

            <TouchableOpacity accessibilityRole="button" accessibilityLabel={alreadyVerified ? 'Go to sign in' : 'Verify email'} onPress={alreadyVerified ? goToLogin : handleVerify} disabled={loading || (!alreadyVerified && (expired || !email))} activeOpacity={0.85}
              style={{ width: '100%', height: verticalScale(54), borderRadius: scale(16), justifyContent: 'center', alignItems: 'center', backgroundColor: expired ? '#D6E4D8' : '#3F8451', opacity: loading ? 0.7 : 1 }}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontSize: moderateScale(16), fontWeight: '700', color: '#fff' }}>{alreadyVerified ? 'Go to sign in' : expired ? t('auth.codeExpired') : t('auth.verifyButton')}</Text>}
            </TouchableOpacity>
            {loading && <Text style={{ fontSize: moderateScale(13), color: '#65796A', textAlign: 'center', marginTop: verticalScale(12) }}>Verifying your email and saving your registration. Driver documents may take a moment to upload.</Text>}

            {!alreadyVerified && (
              <TouchableOpacity accessibilityRole="button" onPress={handleResend} disabled={loading || resendWait > 0 || !email} style={{ alignItems: 'center', marginTop: verticalScale(20) }}>
                <Text style={{ fontSize: moderateScale(14), color: resendWait ? '#8FA092' : '#3F8451', fontWeight: '600' }}>{resendWait ? `Resend code in ${resendWait}s` : t('auth.resendCode')}</Text>
              </TouchableOpacity>
            )}
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
