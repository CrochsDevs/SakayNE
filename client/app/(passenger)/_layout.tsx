import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Platform } from 'react-native';
import { useTheme } from '@/src/store/theme';

export default function PassengerLayout() {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textTertiary,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.borderLight,
            height: Platform.OS === 'ios' ? 88 : 65,
            paddingBottom: Platform.OS === 'ios' ? 28 : 10,
            paddingTop: 8,
            elevation: 0,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: -2 },
          tabBarIconStyle: { marginBottom: -2 },
        }}
      >
        <Tabs.Screen name="home" options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={22} color={color} />,
        }} />
        <Tabs.Screen name="rides" options={{
          title: 'Rides',
          tabBarIcon: ({ color }) => <Ionicons name="car-outline" size={22} color={color} />,
        }} />
        <Tabs.Screen name="settings" options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={22} color={color} />,
        }} />
      </Tabs>
    </View>
  );
}
