import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useScrollToTop } from 'expo-router';
import { useCallback, useRef, type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type RefreshControlProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TopBannerAd } from '@/components/ads/ad-banner';
import { useAds } from '@/providers/ads-context';
import { useAppTheme, usePreferences } from '@/providers/preferences-provider';
import { palette, radius, spacing } from '@/theme/tokens';

type ScreenProps = PropsWithChildren<{
  title: string;
  eyebrow?: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  bottomAd?: ReactNode;
  floatingBottom?: number;
  scrollToTopOnFocus?: boolean;
}>;

export function Screen({
  title,
  eyebrow,
  subtitle,
  onBack,
  backLabel = 'Back',
  refreshControl,
  bottomAd,
  floatingBottom,
  scrollToTopOnFocus = false,
  children,
}: ScreenProps) {
  const scrollRef = useRef<ScrollView>(null);
  const inactiveScrollRef = useRef<ScrollView>(null);
  const { isDark, colors } = useAppTheme();
  const { adsEnabled } = useAds();
  const { toggleDarkMode, ready } = usePreferences();
  const showBottomAd = Boolean(bottomAd) && adsEnabled;

  // React Navigation handles a second press on the active tab, while the focus
  // effect also resets retained tab screens when the user switches between tabs.
  useScrollToTop(scrollToTopOnFocus ? scrollRef : inactiveScrollRef);
  useFocusEffect(
    useCallback(() => {
      if (scrollToTopOnFocus) {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      }
    }, [scrollToTopOnFocus]),
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={showBottomAd ? ['top', 'bottom'] : ['top']}>
      <TopBannerAd />
      <LinearGradient
        colors={[palette.blue600, palette.coral600]}
        end={{ x: 1, y: 0 }}
        start={{ x: 0, y: 0 }}
        style={styles.header}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.headerButtonPressed]}>
            <Ionicons name="arrow-back" size={21} color={palette.white} />
          </Pressable>
        ) : null}
        <View style={styles.headerCopy}>
          {eyebrow ? (
            <Text style={styles.eyebrow}>{eyebrow}</Text>
          ) : null}
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle}>{subtitle}</Text>
          ) : null}
        </View>
      </LinearGradient>
      <ScrollView
        ref={scrollRef}
        style={[styles.scroll, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      {showBottomAd ? (
        <View
          accessibilityRole="summary"
          style={[
            styles.bottomAdSlot,
            { backgroundColor: colors.surface, borderTopColor: colors.border },
          ]}>
          {bottomAd}
        </View>
      ) : null}
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={isDark ? 'Use light mode' : 'Use dark mode'}
        accessibilityState={{ checked: isDark, disabled: !ready }}
        disabled={!ready}
        onPress={toggleDarkMode}
        style={({ pressed }) => [
          styles.themeToggle,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            bottom: floatingBottom ?? (showBottomAd ? 88 : 32),
          },
          !ready && styles.themeToggleDisabled,
          pressed && styles.themeTogglePressed,
        ]}>
        <Ionicons
          name={isDark ? 'sunny-outline' : 'moon-outline'}
          size={16}
          color={colors.primary}
        />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.slate50 },
  header: {
    minHeight: 58,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderBottomWidth: 0,
  },
  headerCopy: { flex: 1 },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  headerButtonPressed: { opacity: 0.66 },
  eyebrow: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 2,
  },
  title: { color: palette.white, fontSize: 21, lineHeight: 26, fontWeight: '900' },
  subtitle: { color: 'rgba(255,255,255,0.86)', fontSize: 12, lineHeight: 16, marginTop: 2 },
  scroll: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 840,
    alignSelf: 'center',
    padding: spacing.md,
    paddingBottom: spacing.xxl + 20,
    gap: spacing.md,
  },
  themeToggle: {
    position: 'absolute',
    right: 7,
    bottom: 32,
    zIndex: 20,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 17,
    shadowColor: palette.navy950,
    shadowOpacity: 0.16,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  themeTogglePressed: { opacity: 0.68, transform: [{ scale: 0.95 }] },
  themeToggleDisabled: { opacity: 0.35 },
  bottomAdSlot: {
    minHeight: 58,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
