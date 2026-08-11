import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { BackHandler, Platform, ToastAndroid } from 'react-native';

import { useAppTheme } from '@/providers/preferences-provider';

const ROOT_TAB_PATHS = new Set(['/', '/pick', '/analysis', '/settings']);
const EXIT_CONFIRMATION_WINDOW_MS = 2_000;

export default function TabsLayout() {
  const { colors } = useAppTheme();
  const pathname = usePathname();
  const lastBackPressAt = useRef(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    // Changing tabs or opening/closing a nested screen starts a fresh exit attempt.
    lastBackPressAt.current = 0;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!ROOT_TAB_PATHS.has(pathname)) return false;

      const now = Date.now();
      if (now - lastBackPressAt.current <= EXIT_CONFIRMATION_WINDOW_MS) {
        lastBackPressAt.current = 0;
        BackHandler.exitApp();
        return true;
      }

      lastBackPressAt.current = now;
      ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
      return true;
    });

    return () => subscription.remove();
  }, [pathname]);

  return (
    <Tabs
      screenOptions={{
        freezeOnBlur: true,
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700', paddingBottom: 3 },
        tabBarStyle: {
          minHeight: 68,
          paddingTop: 8,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Results',
          tabBarAccessibilityLabel: 'Results tab',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="pick"
        options={{
          title: 'Pick',
          tabBarAccessibilityLabel: 'Pick tab',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ticket-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="analysis"
        options={{
          title: 'Analysis',
          tabBarAccessibilityLabel: 'Analysis tab',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="analytics-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarAccessibilityLabel: 'Settings tab',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
