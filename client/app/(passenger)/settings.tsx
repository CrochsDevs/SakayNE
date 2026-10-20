import { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '@/src/auth/auth.service';
import { User } from '@/src/types';
import { router, useFocusEffect } from 'expo-router';
import Avatar from '@/src/components/ui/Avatar';
import ConfirmModal from '@/src/components/ui/ConfirmModal';
import { useTheme } from '@/src/store/theme';
import { useTranslation } from 'react-i18next';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { isDark, colors, toggleTheme } = useTheme();
  const langLabel = i18n.language === 'fil' ? 'Filipino' : 'English';
  const [user, setUser] = useState<User | null>(null);
  const [showLogout, setShowLogout] = useState(false);

  useFocusEffect(useCallback(() => { getCurrentUser().then(setUser); }, []));

  if (!user) return null;

  const menu = [
    {
      section: t('settings.account'),
      items: [
        { icon: 'person-circle-outline', label: t('settings.personalInfo'), desc: t('settings.personalInfoDesc'), color: colors.primary, route: 'account-info' },
        { icon: 'lock-closed-outline', label: t('settings.passwordSecurity'), desc: t('settings.passwordSecurityDesc'), color: colors.softFern, route: 'password-security' },
      ],
    },
    {
      section: t('settings.preferences'),
      items: [
        { icon: 'moon-outline', label: t('settings.darkMode'), desc: isDark ? 'On' : 'Off', color: colors.mossGreen, route: '', isToggle: true },
        { icon: 'notifications-outline', label: t('settings.notifications'), desc: t('settings.notificationsDesc'), color: colors.softFern, route: 'notifications' },
        { icon: 'globe-outline', label: t('settings.language'), desc: langLabel, color: colors.sageLeaf, route: 'language' },
      ],
    },
    {
      section: t('settings.support'),
      items: [
        { icon: 'help-circle-outline', label: t('settings.helpCenter'), desc: t('settings.helpCenterDesc'), color: colors.emeraldDepth, route: 'help-center' },
        { icon: 'information-circle-outline', label: t('settings.about'), desc: t('settings.aboutDesc'), color: colors.textTertiary, route: 'about' },
      ],
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 }}>
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <Avatar name={user.fullName} size={72} avatar={user.avatar} />
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 12 }}>{user.fullName}</Text>
            <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{user.email}</Text>
          </View>

          {menu.map((section, si) => (
            <View key={si} style={{ marginBottom: 28 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>
                {section.section}
              </Text>
              <View style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden' }}>
                {section.items.map((item: any, ii: number) => (
                  <TouchableOpacity
                    key={ii}
                    onPress={() => { if (item.isToggle) { toggleTheme(); } else if (item.route) { router.push(`/${item.route}` as any); } }}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: ii < section.items.length - 1 ? 1 : 0, borderBottomColor: colors.borderLight }}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: item.color + '20', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                      <Ionicons name={item.icon as any} size={18} color={item.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{item.label}</Text>
                      <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 1 }}>{item.desc}</Text>
                    </View>
                    {item.isToggle ? (
                      <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: colors.border, true: colors.primary + '60' }} thumbColor={isDark ? colors.primary : '#fff'} />
                    ) : (
                      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          <TouchableOpacity onPress={() => setShowLogout(true)} activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.error + '30' }}>
            <Ionicons name="log-out-outline" size={18} color={colors.error} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.error, marginLeft: 8 }}>{t('settings.signOut')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={showLogout}
        title={t('settings.signOut')}
        message={t('settings.signOutMessage')}
        confirmText={t('settings.signOut')}
        cancelText={t('common.cancel')}
        type="warning"
        onConfirm={() => { setShowLogout(false); router.replace('/(auth)/logout'); }}
        onCancel={() => setShowLogout(false)}
      />
    </SafeAreaView>
  );
}
