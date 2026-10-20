import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@/src/components/ui/Input';
import { useTheme } from '@/src/store/theme';
import { getCurrentUser, changePassword } from '@/src/auth/auth.service';
import { showError, showSuccess } from '@/src/utils/toast';
import DotLoader from '@/src/components/ui/DotLoader';
import { useTranslation } from 'react-i18next';

export default function PasswordSecurityScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUpdate = async () => {
    setError('');
    if (!currentPassword) { setError('Enter your current password'); return; }
    if (newPassword.length < 8) { setError('New password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }

    const user = await getCurrentUser();
    if (!user?.email) { setError('User not found'); return; }

    setLoading(true);
    try {
      await changePassword(user.email, currentPassword, newPassword);
      showSuccess('Password updated!');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: any) {
      setError(err.message);
      showError('Failed', err.message);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.backgroundAlt, justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>

          <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 6 }}>{t('password.title')}</Text>
          <Text style={{ fontSize: 14, color: colors.textTertiary, marginBottom: 32 }}>{t('password.subtitle')}</Text>

          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20 }}>
            <Input label={t('password.current')} value={currentPassword} onChangeText={(t) => { setCurrentPassword(t); setError(''); }} secureTextEntry icon="lock-closed-outline" darkTheme={isDark} />
            <Input label={t('password.new')} value={newPassword} onChangeText={(t) => { setNewPassword(t); setError(''); }} secureTextEntry icon="lock-closed-outline" darkTheme={isDark} />
            <Input label={t('password.confirm')} value={confirmPassword} onChangeText={(t) => { setConfirmPassword(t); setError(''); }} secureTextEntry icon="lock-closed-outline" darkTheme={isDark} />
            {error ? <Text style={{ fontSize: 13, color: colors.error, marginBottom: 12, marginLeft: 4 }}>{error}</Text> : null}
            <TouchableOpacity onPress={handleUpdate} disabled={loading} activeOpacity={0.85}
              style={{ width: '100%', height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary, marginTop: 8, opacity: loading ? 0.7 : 1 }}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>{t('password.update')}</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {loading && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
          <DotLoader color="#3F8451" size={12} />
        </View>
      )}
    </SafeAreaView>
  );
}
