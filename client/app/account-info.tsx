import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, type KeyboardTypeOptions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getCurrentUser, updateUserProfile, uploadAvatar } from '@/src/auth/auth.service';
import { User } from '@/src/types';
import Avatar from '@/src/components/ui/Avatar';
import { useTheme } from '@/src/store/theme';
import { showError, showSuccess } from '@/src/utils/toast';
import { useTranslation } from 'react-i18next';

function ProfileField({ label, icon, value, editable = false, onChangeText, keyboardType = 'default', last = false }: {
  label: string; icon: keyof typeof Ionicons.glyphMap; value: string; editable?: boolean;
  onChangeText?: (value: string) => void; keyboardType?: KeyboardTypeOptions; last?: boolean;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return <View style={[styles.field, { borderBottomWidth: last ? 0 : 1, borderColor: colors.borderLight }]}>
    <View style={[styles.fieldIcon, { backgroundColor: colors.mintSurface }]}><Ionicons name={icon} size={20} color={colors.primaryLight} /></View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      {editable ? <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} keyboardType={keyboardType} autoCapitalize={keyboardType === 'default' ? 'words' : 'none'} autoCorrect={false} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder={label} placeholderTextColor={colors.textTertiary} style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundAlt, borderColor: focused ? colors.borderFocused : colors.border }]} /> :
        <Text selectable style={[styles.fieldValue, { color: colors.text }]}>{value || '—'}</Text>}
    </View>
    {!editable && icon === 'mail-outline' && <Ionicons name="lock-closed-outline" size={14} color={colors.textTertiary} />}
  </View>;
}

export default function AccountInfoScreen() {
  const { t } = useTranslation();
  const { colors, brand } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [nameError, setNameError] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    getCurrentUser().then(current => {
      if (!active || !current) return;
      setUser(current); setFullName(current.fullName); setPhone(current.phone || '');
    });
    return () => { active = false; };
  }, []));

  const pickImage = async () => {
    if (!user?._id || uploading || saving) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true });
      if (result.canceled || !result.assets[0]?.base64) return;
      const asset = result.assets[0];
      if ((asset.base64!.length * 3) / 4 > 5 * 1024 * 1024) { showError(t('errors.imageTooLarge')); return; }
      setUploading(true);
      const avatar = await uploadAvatar(user._id, asset.base64!, asset.mimeType || 'image/jpeg');
      setUser(current => current ? { ...current, avatar } : null);
      showSuccess(t('account.photoUpdated'));
    } catch (error) { showError(t('errors.generic'), error instanceof Error ? error.message : undefined); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!user?._id || saving || uploading) return;
    const nextName = fullName.trim();
    if (!nextName) { setNameError(t('account.nameRequired')); return; }
    setSaving(true);
    try {
      await updateUserProfile(user._id, { fullName: nextName, phone: phone.trim() });
      setUser(current => current ? { ...current, fullName: nextName, phone: phone.trim() } : null);
      setFullName(nextName); setPhone(phone.trim()); setEditing(false); setNameError('');
      showSuccess(t('account.saveChanges'));
    } catch (error) { showError(t('errors.generic'), error instanceof Error ? error.message : undefined); }
    finally { setSaving(false); }
  };

  const beginEdit = () => {
    if (!user) return;
    setFullName(user.fullName); setPhone(user.phone || ''); setNameError(''); setEditing(true);
  };
  const cancelEdit = () => {
    if (!user) return;
    setFullName(user.fullName); setPhone(user.phone || ''); setNameError(''); setEditing(false);
  };
  const busy = saving || uploading;

  if (!user) return <SafeAreaView style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.primaryLight} /></SafeAreaView>;

  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined} style={{ flex: 1 }}>
      <View style={[styles.navigation, { borderColor: colors.borderLight }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('common.back')} disabled={busy} onPress={() => router.back()} style={[styles.backButton, { borderColor: colors.border, backgroundColor: colors.card }]}><Ionicons name="arrow-back" size={21} color={colors.text} /></TouchableOpacity>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{t('account.myProfile')}</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.profileCard, { backgroundColor: colors.mintSurface, borderColor: colors.border }]}>
          <View style={styles.avatarRing}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('account.changePhoto')} accessibilityState={{ disabled: busy, busy: uploading }} disabled={busy} onPress={() => { void pickImage(); }} activeOpacity={0.85}>
              <Avatar name={user.fullName} size={92} avatar={user.avatar} editable />
              {uploading && <View style={styles.photoLoading}><ActivityIndicator color="#FFFFFF" /></View>}
            </TouchableOpacity>
          </View>
          <Text style={[styles.name, { color: colors.text }]}>{user.fullName}</Text>
          <View style={[styles.roleBadge, { backgroundColor: colors.accentSurface }]}><Ionicons name="sparkles" size={12} color={colors.onAccent} /><Text style={{ color: colors.onAccent, fontSize: 11, fontWeight: '700' }}>{user.role === 'passenger' ? 'Sakay ka-biyahe' : user.role === 'driver' ? 'Sakay driver' : 'Sakay admin'}</Text></View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={uploading ? t('account.uploading') : t('account.changePhoto')} disabled={busy} onPress={() => { void pickImage(); }} style={styles.changePhoto}><Text style={{ color: colors.primaryLight, fontSize: 13, fontWeight: '700' }}>{uploading ? t('account.uploading') : t('account.changePhoto')}</Text></TouchableOpacity>
        </View>

        <View style={styles.detailsHeading}>
          <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.4 }}>{t('account.personalDetails')}</Text><Text style={[styles.description, { color: colors.textSecondary }]}>{t('account.profileHint')}</Text></View>
          <View style={[styles.detailsIcon, { backgroundColor: colors.accentSurface }]}><Ionicons name={editing ? 'create-outline' : 'person-outline'} size={21} color={colors.onAccent} /></View>
        </View>
        <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ProfileField label={t('auth.fullName')} icon="person-outline" value={editing ? fullName : user.fullName} editable={editing && !saving} onChangeText={value => { setFullName(value); setNameError(''); }} />
          {!!nameError && <Text accessibilityLiveRegion="polite" style={{ color: colors.error, fontSize: 12, lineHeight: 18, paddingBottom: 10 }}>{nameError}</Text>}
          <ProfileField label={t('auth.emailLabel')} icon="mail-outline" value={user.email} />
          <ProfileField label={t('auth.phone')} icon="call-outline" value={editing ? phone : user.phone} editable={editing && !saving} onChangeText={setPhone} keyboardType="phone-pad" last />
        </View>
        <View style={styles.emailHint}><Ionicons name="lock-closed-outline" size={13} color={colors.textTertiary} /><Text style={{ color: colors.textTertiary, fontSize: 12, lineHeight: 18, flex: 1 }}>{t('account.emailHint')}</Text></View>
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={[styles.footer, { backgroundColor: colors.background, borderColor: colors.borderLight }]}>
        <View style={styles.actions}>
          {editing && <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('common.cancel')} disabled={busy} onPress={cancelEdit} style={[styles.cancelButton, { borderColor: colors.border, backgroundColor: colors.card }]}><Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{t('common.cancel')}</Text></TouchableOpacity>}
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={editing ? t('account.saveChanges') : t('account.editProfile')} accessibilityState={{ disabled: busy, busy: saving }} disabled={busy} onPress={() => editing ? void handleSave() : beginEdit()} activeOpacity={0.85} style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: busy ? 0.65 : 1 }]}>
            {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name={editing ? 'checkmark' : 'create-outline'} size={20} color={editing ? '#FFFFFF' : brand.sunshine} />}
            <Text style={{ color: colors.onPrimary, fontSize: 15, fontWeight: '700' }}>{saving ? t('common.loading') : editing ? t('account.saveChanges') : t('account.editProfile')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  navigation: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, paddingHorizontal: 20, paddingVertical: 12 },
  backButton: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 20, gap: 20, paddingBottom: 28 },
  profileCard: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8, borderRadius: 26, borderWidth: 1 },
  avatarRing: { padding: 5, marginBottom: 14 },
  photoLoading: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  name: { fontSize: 23, fontWeight: '800', letterSpacing: -0.6, lineHeight: 30, textAlign: 'center' },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 12, marginTop: 9 },
  changePhoto: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, marginTop: 5 },
  detailsHeading: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  description: { fontSize: 12, lineHeight: 19, marginTop: 5 },
  detailsIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  detailsCard: { borderWidth: 1, borderRadius: 22, paddingHorizontal: 16 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 18 },
  fieldIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 11, marginBottom: 6 },
  fieldValue: { fontSize: 14, lineHeight: 21 },
  input: { minHeight: 44, fontSize: 14, paddingHorizontal: 10, paddingVertical: 10, borderWidth: 1, borderRadius: 10, width: '100%' },
  emailHint: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 5, marginTop: -7 },
  footer: { borderTopWidth: 1 },
  actions: { width: '100%', maxWidth: 600, alignSelf: 'center', flexDirection: 'row', gap: 10, padding: 16, paddingHorizontal: 20 },
  primaryButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 54, paddingHorizontal: 16, borderRadius: 17 },
  cancelButton: { minHeight: 54, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderRadius: 17, paddingHorizontal: 23 },
});
