import { type ComponentProps } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, View, type ColorValue, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/store/theme';

export function useAppTabBar(tabCount = 5) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { fontScale, width } = useWindowDimensions();
  const compact = tabCount > 5 && width < 420;
  const labelWidth = compact ? Math.floor((width - insets.left - insets.right) / tabCount) - 2 : undefined;
  const bottomPadding = Math.max(insets.bottom, 8);
  const labelExtraHeight = Math.ceil(16 * (Math.min(fontScale, 1.2) - 1));

  return {
    headerShown: false,
    tabBarLabelPosition: 'below-icon',
    tabBarHideOnKeyboard: true,
    tabBarActiveTintColor: colors.primaryLight,
    tabBarInactiveTintColor: colors.textSecondary,
    tabBarStyle: {
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      height: 72 + labelExtraHeight + bottomPadding,
      paddingTop: 6,
      paddingBottom: bottomPadding,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      elevation: 0,
    },
    tabBarItemStyle: { minWidth: 0, paddingHorizontal: 0, paddingVertical: 0 },
    tabBarIconStyle: { width: 52, height: 34, flexShrink: 0 },
    tabBarLabel: ({ color, focused, children }) => <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ color, width: labelWidth, maxWidth: labelWidth, fontSize: compact ? children === 'Community' && width < 350 ? 9.5 : 10 : 12, lineHeight: 16, minHeight: 16, flexShrink: 0, fontWeight: focused ? '700' : '600', marginTop: 4, textAlign: 'center', letterSpacing: -0.2 }}>{children}</Text>,
  } satisfies NonNullable<ComponentProps<typeof Tabs>['screenOptions']>;
}

export function AppTabIcon({ name, focused, color }: { name: keyof typeof Ionicons.glyphMap; focused: boolean; color: ColorValue }) {
  const { brand } = useTheme();
  return <View style={{ width: 52, height: 34, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? brand.sunshine : 'transparent' }}>
    <Ionicons name={name} size={24} color={focused ? brand.ink : color} />
  </View>;
}
