import { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/store/theme';
import { getLanguage, setLanguage } from '@/src/store/language';
import i18n from '@/src/i18n/config';

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'fil', label: 'Filipino', native: 'Tagalog' },
];

export default function LanguageScreen() {
  const { colors } = useTheme();
  const [selected, setSelected] = useState('en');

  useFocusEffect(useCallback(() => {
    getLanguage().then(setSelected);
  }, []));

  const handleSelect = async (code: string) => {
    setSelected(code);
    await setLanguage(code);
    i18n.changeLanguage(code);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.backgroundAlt, justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 32 }}>Language</Text>
        <View style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden' }}>
          {LANGUAGES.map((lang, i) => (
            <TouchableOpacity key={lang.code} onPress={() => handleSelect(lang.code)}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: i < LANGUAGES.length - 1 ? 1 : 0, borderBottomColor: colors.borderLight }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{lang.label}</Text>
                <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 1 }}>{lang.native}</Text>
              </View>
              {selected === lang.code && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
