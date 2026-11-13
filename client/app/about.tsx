import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTheme } from '@/src/store/theme';
import { useTranslation } from 'react-i18next';

export default function AboutScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.backgroundAlt, justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <Image source={require('@/assets/logo/SakayNE.png')} style={{ width: 80, height: 80 }} contentFit="contain" />
          <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, marginTop: 16 }}>Sakay</Text>
          <Text style={{ fontSize: 14, color: colors.textTertiary, marginTop: 4 }}>{t('about.version')}</Text>
        </View>

        <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 22, textAlign: 'center' }}>
            {t('about.desc')}
          </Text>
        </View>

        <View style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden' }}>
          {[
            { icon: 'shield-checkmark-outline', label: t('about.privacy'), topic: 'privacy' },
            { icon: 'document-text-outline', label: t('about.terms'), topic: 'terms' },
            { icon: 'code-slash-outline', label: t('about.licenses'), topic: 'licenses' },
          ].map((item, i) => (
            <TouchableOpacity key={i} onPress={() => router.push({ pathname: '/app-information', params: { topic: item.topic } })} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: colors.borderLight }}>
              <Ionicons name={item.icon as any} size={18} color={colors.primary} style={{ marginRight: 14 }} />
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.text }}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ fontSize: 12, color: colors.textTertiary, textAlign: 'center', marginTop: 24 }}>
          {t('about.powered')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
