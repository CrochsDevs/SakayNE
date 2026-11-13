import { View, Text, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/src/store/theme';

export default function DriverSettingsScreen() {
  const { isDark, colors, toggleTheme } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView>
        <View style={{ padding: 24 }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: isDark ? '#fff' : '#153B43', marginBottom: 20 }}>Settings</Text>

          <View style={{ backgroundColor: colors.card, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
            {[{ icon: 'person-outline' as const, label: 'Account information', route: '/account-info' }, { icon: 'lock-closed-outline' as const, label: 'Password & security', route: '/password-security' }, { icon: 'moon-outline' as const, label: 'Dark Mode', isToggle: true }, { icon: 'notifications-outline' as const, label: 'Notifications', route: '/notifications' }, { icon: 'help-circle-outline' as const, label: 'Help Center', route: '/help-center' }].map((item, i) => (
              <TouchableOpacity key={i} onPress={() => { if (item.isToggle) toggleTheme(); else if (item.route) router.push(item.route as any); }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#EAF0EC' }}>
                <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.mintSurface, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}><Ionicons name={item.icon} size={20} color={colors.primaryLight} /></View>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: isDark ? '#fff' : '#153B43' }}>{item.label}</Text>
                {item.isToggle ? <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: '#E5E7EB', true: '#087F8C' }} /> : <Ionicons name="chevron-forward" size={18} color={isDark ? 'rgba(255,255,255,0.2)' : '#DCE8E5'} />}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity onPress={() => router.replace('/(auth)/logout')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: '#EF4444', marginTop: 24 }}>
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#EF4444', marginLeft: 8 }}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
