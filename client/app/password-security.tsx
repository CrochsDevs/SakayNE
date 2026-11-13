import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/store/theme';
import { getCurrentUser, changePassword } from '@/src/auth/auth.service';
import { showSuccess } from '@/src/utils/toast';
import { useTranslation } from 'react-i18next';

function PasswordField({ label, placeholder, value, onChangeText, error, current = false, disabled }: {
  label: string; placeholder: string; value: string; onChangeText: (value: string) => void;
  error?: string; current?: boolean; disabled: boolean;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  return <View style={styles.fieldGroup}>
    <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    <View style={[styles.field, { backgroundColor: colors.surfaceElevated, borderColor: error ? colors.error : focused ? colors.borderFocused : colors.border }]}>
      <Ionicons name={current ? 'lock-closed-outline' : 'key-outline'} size={19} color={focused ? colors.primaryLight : colors.textTertiary} />
      <TextInput accessibilityLabel={label} accessibilityHint={error} value={value} onChangeText={onChangeText} editable={!disabled} placeholder={placeholder} placeholderTextColor={colors.textTertiary} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} autoComplete={current ? 'current-password' : 'new-password'} textContentType={current ? 'password' : 'newPassword'} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={[styles.input, { color: colors.text }]} />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t(visible ? 'password.hideField' : 'password.showField', { field: label })} accessibilityState={{ disabled, expanded: visible }} disabled={disabled} onPress={() => setVisible(!visible)} style={styles.visibilityButton}><Ionicons name={visible ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textSecondary} /></TouchableOpacity>
    </View>
    {!!error && <Text accessibilityLiveRegion="polite" style={{ color: colors.error, fontSize: 12, lineHeight: 18 }}>{error}</Text>}
  </View>;
}

export default function PasswordSecurityScreen() {
  const { t } = useTranslation();
  const { colors, brand } = useTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [serverError, setServerError] = useState('');
  const minimumLength = newPassword.length >= 8;
  const passwordsMatch = !!newPassword && !!confirmPassword && newPassword === confirmPassword;

  const handleUpdate = async () => {
    if (loading) return;
    setServerError('');
    const nextErrors = {
      current: currentPassword ? undefined : t('password.currentRequired'),
      next: minimumLength ? undefined : t('password.newTooShort'),
      confirm: passwordsMatch ? undefined : t('password.mismatch'),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    setLoading(true);
    try {
      const user = await getCurrentUser();
      if (!user?.email) throw new Error(t('errors.generic'));
      await changePassword(user.email, currentPassword, newPassword);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setErrors({});
      showSuccess(t('password.updated'));
    } catch (error) { setServerError(error instanceof Error ? error.message : t('errors.generic')); }
    finally { setLoading(false); }
  };

  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined} style={{ flex: 1 }}>
      <View style={[styles.navigation, { borderColor: colors.borderLight }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('common.back')} disabled={loading} onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]}><Ionicons name="arrow-back" size={21} color={colors.text} /></TouchableOpacity>
        <Text style={[styles.navigationTitle, { color: colors.text }]}>{t('password.title')}</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.intro, { backgroundColor: colors.mintSurface, borderColor: colors.border }]}>
          <View style={[styles.shield, { backgroundColor: colors.accentSurface }]}><Ionicons name="shield-checkmark-outline" size={32} color={colors.onAccent} /></View>
          <View style={{ flex: 1, minWidth: 0 }}><Text style={[styles.introTitle, { color: colors.text }]}>{t('password.introTitle')}</Text><Text style={[styles.description, { color: colors.textSecondary }]}>{t('password.subtitle')}</Text></View>
        </View>

        <View style={styles.sectionHeading}><Text style={{ color: colors.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.4 }}>{t('password.changeTitle')}</Text><View style={[styles.headingAccent, { backgroundColor: brand.sunshine }]} /></View>
        <View style={[styles.form, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <PasswordField label={t('password.current')} placeholder={t('password.currentPlaceholder')} value={currentPassword} onChangeText={value => { setCurrentPassword(value); setErrors(previous => ({ ...previous, current: undefined })); setServerError(''); }} error={errors.current} current disabled={loading} />
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
          <PasswordField label={t('password.new')} placeholder={t('password.newPlaceholder')} value={newPassword} onChangeText={value => { setNewPassword(value); setErrors(previous => ({ ...previous, next: undefined, confirm: undefined })); setServerError(''); }} error={errors.next} disabled={loading} />
          <PasswordField label={t('password.confirm')} placeholder={t('password.confirmPlaceholder')} value={confirmPassword} onChangeText={value => { setConfirmPassword(value); setErrors(previous => ({ ...previous, confirm: undefined })); setServerError(''); }} error={errors.confirm} disabled={loading} />
        </View>
        <View style={[styles.requirements, { backgroundColor: colors.backgroundAlt }]}>
          {[{ met: minimumLength, label: t('password.minimumLength') }, { met: passwordsMatch, label: t('password.passwordsMatch') }].map(item => <View key={item.label} style={styles.requirement}><Ionicons name={item.met ? 'checkmark-circle' : 'ellipse-outline'} size={17} color={item.met ? colors.primaryLight : colors.textTertiary} /><Text style={{ color: item.met ? colors.primaryLight : colors.textSecondary, fontSize: 12, lineHeight: 19, flex: 1 }}>{item.label}</Text></View>)}
        </View>
        {!!serverError && <View accessibilityLiveRegion="polite" style={[styles.errorBanner, { backgroundColor: colors.coralSurface }]}><Ionicons name="alert-circle-outline" size={20} color={colors.error} /><Text style={{ flex: 1, color: colors.error, fontSize: 13, lineHeight: 20 }}>{serverError}</Text></View>}
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={[styles.footer, { backgroundColor: colors.background, borderColor: colors.borderLight }]}>
        <View style={styles.footerContent}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('password.update')} accessibilityState={{ disabled: loading, busy: loading }} disabled={loading} onPress={() => { void handleUpdate(); }} activeOpacity={0.85} style={[styles.updateButton, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}>
            {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="lock-closed-outline" size={19} color={brand.sunshine} />}
            <Text style={{ color: colors.onPrimary, fontSize: 15, fontWeight: '700' }}>{loading ? t('common.loading') : t('password.update')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  navigation: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottomWidth: 1, paddingHorizontal: 20, paddingVertical: 12 },
  navigationTitle: { flex: 1, minWidth: 0, textAlign: 'center', fontSize: 16, lineHeight: 22, fontWeight: '700' },
  backButton: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 20, paddingBottom: 28, gap: 20 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 15, borderWidth: 1, borderRadius: 24, padding: 20 },
  shield: { width: 60, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] },
  introTitle: { fontSize: 19, fontWeight: '800', lineHeight: 25, letterSpacing: -0.4 },
  description: { fontSize: 12, lineHeight: 19, marginTop: 7 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headingAccent: { width: 22, height: 4, borderRadius: 2 },
  form: { padding: 18, borderWidth: 1, borderRadius: 24, gap: 20 },
  fieldGroup: { gap: 8 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingLeft: 12, paddingRight: 3, minHeight: 54, borderWidth: 1, borderRadius: 15 },
  input: { flex: 1, minWidth: 0, fontSize: 14, paddingVertical: 15, backgroundColor: 'transparent' },
  visibilityButton: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1 },
  requirements: { padding: 15, borderRadius: 17, gap: 10 },
  requirement: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 15, borderRadius: 16 },
  footer: { borderTopWidth: 1 },
  footerContent: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 16, paddingHorizontal: 20 },
  updateButton: { minHeight: 54, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16 },
});