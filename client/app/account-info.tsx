import { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getCurrentUser, updateUserProfile, uploadAvatar } from '@/src/auth/auth.service';
import { User } from '@/src/types';
import { Input } from '@/src/components/ui/Input';
import Avatar from '@/src/components/ui/Avatar';
import DotLoader from '@/src/components/ui/DotLoader';
import { useTheme } from '@/src/store/theme';
import { showError, showSuccess } from '@/src/utils/toast';
import { useTranslation } from 'react-i18next';

export default function AccountInfoScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  useFocusEffect(useCallback(() => {
    getCurrentUser().then((u) => { if (u) { setUser(u); setFullName(u.fullName); setEmail(u.email); setPhone(u.phone); } });
  }, []));

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true });
    if (!result.canceled && result.assets[0]?.base64) {
      const size = (result.assets[0].base64.length * 3) / 4;
      if (size > 5 * 1024 * 1024) { showError(t('errors.imageTooLarge')); return; }
      setUploading(true);
      try { const url = await uploadAvatar(user!._id!, result.assets[0].base64, result.assets[0].mimeType || 'image/jpeg'); setUser((p) => p ? { ...p, avatar: url } : null); showSuccess(t('account.title')); }
      catch (err: any) { showError(t('errors.generic'), err.message); }
      finally { setUploading(false); }
    }
  };

  const handleSave = async () => {
    if (!user?._id) return; setSaving(true);
    try { await updateUserProfile(user._id, { fullName, phone }); setUser((p) => p ? { ...p, fullName, phone } : null); setEditing(false); showSuccess(t('account.saveChanges')); }
    catch (err: any) { showError(t('errors.generic'), err.message); }
    finally { setSaving(false); }
  };

  if (!user) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.backgroundAlt, justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <TouchableOpacity onPress={pickImage}><Avatar name={user.fullName} size={88} avatar={user.avatar} editable /></TouchableOpacity>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 16 }}>{user.fullName}</Text>
            <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{user.email}</Text>
          </View>
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20 }}>
            <Input label={t('auth.fullName')} value={fullName} onChangeText={setFullName} icon="person-outline" editable={editing} autoCapitalize="words" darkTheme={isDark} />
            <Input label={t('auth.emailLabel')} value={email} onChangeText={setEmail} keyboardType="email-address" icon="mail-outline" editable={false} darkTheme={isDark} />
            <Input label={t('auth.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" icon="phone-portrait-outline" editable={editing} darkTheme={isDark} />
            <TouchableOpacity onPress={() => editing ? handleSave() : setEditing(true)} activeOpacity={0.85} disabled={saving}
              style={{ width: '100%', height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary, marginTop: 12, opacity: saving ? 0.7 : 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>{saving ? t('common.loading') : editing ? t('account.saveChanges') : t('account.editProfile')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {uploading && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}><DotLoader color="#3F8451" size={12} /></View>}
    </SafeAreaView>
  );
}
