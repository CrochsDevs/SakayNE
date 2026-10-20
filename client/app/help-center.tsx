import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/store/theme';
import { useTranslation } from 'react-i18next';

const FAQ_KEYS = [
  { q: 'help.q1', a: 'help.a1' },
  { q: 'help.q2', a: 'help.a2' },
  { q: 'help.q3', a: 'help.a3' },
  { q: 'help.q4', a: 'help.a4' },
];

export default function HelpCenterScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.backgroundAlt, justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 6 }}>{t('help.title')}</Text>
        <Text style={{ fontSize: 14, color: colors.textTertiary, marginBottom: 32 }}>{t('help.subtitle')}</Text>

        <View style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden' }}>
          {FAQ_KEYS.map((faq, i) => (
            <TouchableOpacity key={i} onPress={() => setOpenIndex(openIndex === i ? null : i)}
              style={{ borderBottomWidth: i < FAQ_KEYS.length - 1 ? 1 : 0, borderBottomColor: colors.borderLight }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{t(faq.q)}</Text>
                  {openIndex === i && <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 8, lineHeight: 20 }}>{t(faq.a)}</Text>}
                </View>
                <Ionicons name={openIndex === i ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ alignItems: 'center', marginTop: 32, backgroundColor: colors.card, borderRadius: 16, padding: 24 }}>
          <Ionicons name="mail-outline" size={32} color={colors.primary} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 12, marginBottom: 4 }}>{t('help.needHelp')}</Text>
          <Text style={{ fontSize: 13, color: colors.textTertiary, textAlign: 'center' }}>{t('help.emailUs')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
