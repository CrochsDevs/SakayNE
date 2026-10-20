import { View, Text, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/src/store/theme';

export default function DriverSettingsScreen() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#1A1A2E' : '#fff' }}>
      <ScrollView>
        <View style={{ padding: 24 }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: isDark ? '#fff' : '#0D1F16', marginBottom: 20 }}>Settings</Text>

          <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F9FAFB', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#F0F0F5' }}>
            {[{ icon: 'person-outline' as const, label: 'Account information', route: '/account-info' }, { icon: 'lock-closed-outline' as const, label: 'Password & security', route: '/password-security' }, { icon: 'moon-outline' as const, label: 'Dark Mode', isToggle: true }, { icon: 'notifications-outline' as const, label: 'Notifications', route: '/notifications' }, { icon: 'help-circle-outline' as const, label: 'Help Center', route: '/help-center' }].map((item, i) => (
              <TouchableOpacity key={i} onPress={() => { if (item.isToggle) toggleTheme(); else if (item.route) router.push(item.route as any); }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#F0F0F5' }}>
                <Ionicons name={item.icon} size={20} color={isDark ? '#fff' : '#0D1F16'} style={{ marginRight: 14 }} />
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: isDark ? '#fff' : '#0D1F16' }}>{item.label}</Text>
                {item.isToggle ? <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: '#E5E7EB', true: '#3F8451' }} /> : <Ionicons name="chevron-forward" size={18} color={isDark ? 'rgba(255,255,255,0.2)' : '#D6E4D8'} />}
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
