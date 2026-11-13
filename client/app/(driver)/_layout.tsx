import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useTheme } from '@/src/store/theme';
import { getAuth } from '@/src/auth/auth.store';
import { useState, useEffect } from 'react';
import ApprovalPendingScreen from '@/src/components/ApprovalPendingScreen';
import { refreshCurrentUser } from '@/src/auth/auth.service';
import { usePolling } from '@/src/ride/usePolling';
import { AppTabIcon, useAppTabBar } from '@/src/components/ui/AppTabBar';
import { useInterfaceText } from '@/src/i18n/useInterfaceText';


export default function DriverLayout() {
  const { colors } = useTheme();
  const translate = useInterfaceText();
  const screenOptions = useAppTabBar(6);
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
      <Tabs screenOptions={screenOptions}>
        <Tabs.Screen name="index" options={{
          title: translate('Home'),
          tabBarIcon: ({ color, focused }) => <AppTabIcon name={focused ? 'home' : 'home-outline'} focused={focused} color={color} />,
        }} />
        <Tabs.Screen name="driver-trips" options={{
          title: translate('Trips'),
          tabBarIcon: ({ color, focused }) => <AppTabIcon name={focused ? 'bus' : 'bus-outline'} focused={focused} color={color} />,
        }} />
        <Tabs.Screen name="driver-inbox" options={{
          title: translate('Messages'),
          tabBarIcon: ({ color, focused }) => <AppTabIcon name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} focused={focused} color={color} />,
        }} />
        <Tabs.Screen name="driver-wallet" options={{
          title: translate('Wallet'),
          tabBarIcon: ({ color, focused }) => <AppTabIcon name={focused ? 'wallet' : 'wallet-outline'} focused={focused} color={color} />,
        }} />
        <Tabs.Screen name="driver-community" options={{ title: 'Community', tabBarAccessibilityLabel: 'Community, coming soon',
          tabBarIcon: ({ color, focused }) => <AppTabIcon name={focused ? 'people' : 'people-outline'} focused={focused} color={color} />,
        }} />
        <Tabs.Screen name="settings" options={{
          title: translate('Settings'),
          tabBarIcon: ({ color, focused }) => <AppTabIcon name={focused ? 'settings' : 'settings-outline'} focused={focused} color={color} />,
        }} />
      </Tabs>
    </View>
  );
}
