import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/store/theme';
import { type AppLanguage } from '@/src/store/language';
import { selectLanguage } from '@/src/i18n/config';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en' as const, label: 'English', native: 'English', badge: 'EN' },
  { code: 'fil' as const, label: 'Filipino', native: 'Tagalog', badge: 'FIL' },
];

export default function LanguageScreen() {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const selected = i18n.resolvedLanguage || i18n.language;
  const [saving, setSaving] = useState<AppLanguage | null>(null);
  const [error, setError] = useState('');
  const handleSelect = async (code: AppLanguage) => {
    if (saving || selected === code) return;
    setSaving(code); setError('');
    try { await selectLanguage(code); }
    catch { setError(t('language.saveError')); }
    finally { setSaving(null); }
  };
  const goBack = () => router.canGoBack() ? router.back() : router.replace('/(passenger)/settings');

  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={[styles.navigation, { borderColor: colors.borderLight }]}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={goBack} style={[styles.back, { backgroundColor: colors.card, borderColor: colors.border }]}><Ionicons name="arrow-back" size={21} color={colors.text} /></TouchableOpacity>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{t('language.title')}</Text><View style={{ width: 44 }} />
    </View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={[styles.intro, { backgroundColor: colors.mintSurface, borderColor: colors.border }]}>
        <View style={[styles.globe, { backgroundColor: colors.accentSurface }]}><Ionicons name="language-outline" size={34} color={colors.onAccent} /></View>
        <Text style={[styles.title, { color: colors.text }]}>{t('language.choose')}</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>{t('language.description')}</Text>
      </View>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{t('language.available')}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('language.available')} style={{ gap: 12 }}>
        {LANGUAGES.map(language => {
          const active = selected === language.code;
          return <TouchableOpacity key={language.code} accessibilityRole="radio" accessibilityLabel={language.label} aria-checked={active} accessibilityState={{ checked: active, disabled: !!saving, busy: saving === language.code }} disabled={!!saving} onPress={() => { void handleSelect(language.code); }} style={[styles.language, { backgroundColor: active ? colors.mintSurface : colors.card, borderColor: active ? colors.primaryLight : colors.border }]}>
            <View style={[styles.languageIcon, { backgroundColor: active ? colors.primary : colors.backgroundAlt }]}><Text style={{ color: active ? colors.onPrimary : colors.textSecondary, fontSize: 13, fontWeight: '800' }}>{language.badge}</Text></View>
            <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{language.label}</Text><Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>{language.native}</Text></View>
            {saving === language.code ? <ActivityIndicator color={colors.primaryLight} /> : <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={23} color={active ? colors.primaryLight : colors.textTertiary} />}
          </TouchableOpacity>;
        })}
      </View>
      <View style={styles.hint}><Ionicons name="checkmark-circle-outline" size={18} color={colors.primaryLight} /><Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 20, flex: 1 }}>{t('language.hint')}</Text></View>
      {!!error && <Text accessibilityLiveRegion="polite" style={{ color: colors.error, fontSize: 13 }}>{error}</Text>}
    </ScrollView>
    <SafeAreaView edges={['bottom']} style={[styles.footer, { backgroundColor: colors.background, borderColor: colors.borderLight }]}><View style={styles.footerContent}><TouchableOpacity accessibilityRole="button" accessibilityLabel={t('common.done')} disabled={!!saving} onPress={goBack} style={[styles.done, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}><Text style={{ color: colors.onPrimary, fontSize: 15, fontWeight: '700' }}>{t('common.done')}</Text><Ionicons name="checkmark" size={20} color={colors.onPrimary} /></TouchableOpacity></View></SafeAreaView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  navigation: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, paddingHorizontal: 20, borderBottomWidth: 1 },
  back: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 20, gap: 20, paddingBottom: 28 },
  intro: { padding: 24, borderWidth: 1, borderRadius: 26, alignItems: 'center' },
  globe: { width: 70, height: 70, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginBottom: 18, transform: [{ rotate: '-6deg' }] },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -0.6, textAlign: 'center' },
  description: { fontSize: 13, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  language: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 17, borderRadius: 20, borderWidth: 1.5, minHeight: 82 },
  languageIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  hint: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 3 },
  footer: { borderTopWidth: 1 },
  footerContent: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 16, paddingHorizontal: 20 },
  done: { minHeight: 54, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
});
