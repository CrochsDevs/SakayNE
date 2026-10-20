import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Platform } from 'react-native';
import { useTheme } from '@/src/store/theme';
import { getAuth } from '@/src/auth/auth.store';
import { useState, useEffect } from 'react';
import ApprovalPendingScreen from '@/src/components/ApprovalPendingScreen';
import { refreshCurrentUser } from '@/src/auth/auth.service';
import { usePolling } from '@/src/ride/usePolling';

export default function DriverLayout() {
  const { colors } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const session = usePolling(refreshCurrentUser, null);

  useEffect(() => {
    const loadUser = async () => {
      const { user } = await getAuth();
      setUser(user);
      setLoading(false);
    };
    loadUser();
  }, []);

  const current = session.data || user;
  const isApproved = current?.role === 'driver' ? current?.verified === true && current?.approvalStatus === 'approved' : true;
  const showPending = !loading && current?.role === 'driver' && !isApproved;

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  if (showPending) {
    return <ApprovalPendingScreen status={current?.approvalStatus || 'pending'} fullName={current?.fullName} />;
  }

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
        <Tabs.Screen name="index" options={{
          title: 'Trips',
          tabBarIcon: ({ color }) => <Ionicons name="navigate-outline" size={22} color={color} />,
        }} />
        <Tabs.Screen name="earnings" options={{
          title: 'Earnings',
          tabBarIcon: ({ color }) => <Ionicons name="wallet-outline" size={22} color={color} />,
        }} />
        <Tabs.Screen name="settings" options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={22} color={color} />,
        }} />
      </Tabs>
    </View>
  );
}
