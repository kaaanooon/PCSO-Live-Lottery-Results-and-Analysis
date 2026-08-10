import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AdsProvider } from '@/providers/ads-provider';
import { DrawsProvider, useDraws } from '@/providers/draws-provider';
import { ResultRemindersProvider } from '@/providers/notifications-provider';
import { PreferencesProvider, useAppTheme } from '@/providers/preferences-provider';
import { PurchasesProvider } from '@/providers/purchases-provider';
import { palette, spacing } from '@/theme/tokens';

function InitializationScreen() {
  return (
    <LinearGradient
      colors={[palette.blue600, palette.coral600]}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={styles.initialization}>
      <View style={styles.initializationCard}>
        <Image
          accessibilityLabel="PCSO Lotto Results & Analysis"
          contentFit="contain"
          source={require('@/assets/images/lotto-live-logo-transparent.png')}
          style={styles.logo}
        />
        <ActivityIndicator color={palette.blue600} size="large" />
        <Text style={styles.initializationTitle}>Preparing lotto results</Text>
        <Text style={styles.initializationText}>
          Loading saved data and checking for the latest published results.
        </Text>
        <Text style={styles.initializationNote}>
          This first-time setup also works offline with the built-in archive.
        </Text>
      </View>
    </LinearGradient>
  );
}

function AppNavigator() {
  const { colors, isDark } = useAppTheme();
  const { initializing } = useDraws();
  if (initializing) {
    return (
      <>
        <StatusBar style="light" />
        <InitializationScreen />
      </>
    );
  }
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <PreferencesProvider>
      <PurchasesProvider>
        <ResultRemindersProvider>
          <AdsProvider>
            <DrawsProvider>
              <AppNavigator />
            </DrawsProvider>
          </AdsProvider>
        </ResultRemindersProvider>
      </PurchasesProvider>
    </PreferencesProvider>
  );
}

const styles = StyleSheet.create({
  initialization: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  initializationCard: {
    width: '100%',
    maxWidth: 380,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  logo: { width: 88, height: 88 },
  initializationTitle: {
    color: palette.navy900,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
    textAlign: 'center',
  },
  initializationText: {
    color: palette.slate700,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  initializationNote: {
    color: palette.slate600,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
  },
});
