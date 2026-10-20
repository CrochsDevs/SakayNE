import { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/store/theme';
import { getCurrentUser, getNotifSettings, updateNotifSettings } from '@/src/auth/auth.service';
import { showSuccess, showError } from '@/src/utils/toast';
import { useTranslation } from 'react-i18next';

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [settings, setSettings] = useState({ push: true, email: true, sms: false, promo: true });

  useFocusEffect(useCallback(() => {
    getCurrentUser().then((u) => {
      if (u?.email) getNotifSettings(u.email).then(setSettings).catch(e => showError('Unable to load preferences', e.message));
    });
  }, []));

  const toggle = async (key: keyof typeof settings) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    const user = await getCurrentUser();
    if (user?.email) {
      try {
        await updateNotifSettings(user.email, next);
        showSuccess(`${key} ${next[key] ? 'enabled' : 'disabled'}`);
      } catch { setSettings(settings); showError('Failed to save'); }
    }
  };

  const items = [
    { key: 'push' as const, icon: 'notifications-outline', label: t('notification.push'), desc: t('notification.pushDesc') },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.backgroundAlt, justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 6 }}>{t('notifSettings.title')}</Text>
        <Text style={{ fontSize: 14, color: colors.textTertiary, marginBottom: 32 }}>{t('notifSettings.subtitle')}</Text>
        <View style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden' }}>
          {items.map((item, i) => (
            <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: colors.borderLight }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.backgroundAlt, justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                <Ionicons name={item.icon as any} size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{item.label}</Text>
                <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 1 }}>{item.desc}</Text>
              </View>
              <Switch value={settings[item.key]} onValueChange={() => toggle(item.key)} trackColor={{ false: colors.border, true: colors.primary + '60' }} thumbColor={settings[item.key] ? colors.primary : '#fff'} />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
