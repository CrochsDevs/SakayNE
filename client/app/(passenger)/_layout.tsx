import { Tabs } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AppTabIcon, useAppTabBar } from '@/src/components/ui/AppTabBar';
import { useTheme } from '@/src/store/theme';
import { useInterfaceText } from '@/src/i18n/useInterfaceText';

const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export default function PassengerLayout() {
  const { colors } = useTheme();
  const translate = useInterfaceText();
  const ready = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
  const screenOptions = useAppTabBar();

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}><ActivityIndicator color={colors.primaryLight} /></View>;

  return (
    <View style={{ flex: 1 }}>
      <Tabs screenOptions={screenOptions}>
        <Tabs.Screen name="home" options={{
          title: translate('Home'),
          tabBarIcon: ({ color, focused }) => <AppTabIcon name={focused ? 'home' : 'home-outline'} focused={focused} color={color} />,
        }} />
        <Tabs.Screen name="rides" options={{
          title: translate('Rides'),
          tabBarIcon: ({ color, focused }) => <AppTabIcon name={focused ? 'car' : 'car-outline'} focused={focused} color={color} />,
        }} />
        <Tabs.Screen name="inbox" options={{
          title: translate('Messages'),
          tabBarIcon: ({ color, focused }) => <AppTabIcon name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} focused={focused} color={color} />,
        }} />
        <Tabs.Screen name="wallet" options={{
          title: translate('Wallet'),
          tabBarIcon: ({ color, focused }) => <AppTabIcon name={focused ? 'wallet' : 'wallet-outline'} focused={focused} color={color} />,
        }} />
        <Tabs.Screen name="settings" options={{
          title: translate('Settings'),
          tabBarIcon: ({ color, focused }) => <AppTabIcon name={focused ? 'settings' : 'settings-outline'} focused={focused} color={color} />,
        }} />
      </Tabs>
    </View>
  );
}
