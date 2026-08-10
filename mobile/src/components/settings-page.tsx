import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useScrollToTop } from 'expo-router';
import { useCallback, useMemo, useRef, type PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TopBannerAd } from '@/components/ads/ad-banner';
import { useAppTheme, type AppThemeColors } from '@/providers/preferences-provider';
import { palette, radius, spacing } from '@/theme/tokens';

type SettingsPageProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  eyebrow?: string;
  onBack?: () => void;
  backLabel?: string;
  inTabs?: boolean;
}>;

export function SettingsPage({
  title,
  subtitle,
  eyebrow,
  onBack,
  backLabel = 'Back',
  inTabs = false,
  children,
}: SettingsPageProps) {
  const scrollRef = useRef<ScrollView>(null);
  const inactiveScrollRef = useRef<ScrollView>(null);
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  useScrollToTop(inTabs ? scrollRef : inactiveScrollRef);
  useFocusEffect(
    useCallback(() => {
      if (inTabs) {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      }
    }, [inTabs]),
  );

  return (
    <SafeAreaView
      style={styles.safe}
      edges={inTabs ? ['top'] : ['top', 'bottom']}>
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
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Ionicons name="arrow-back" size={21} color={palette.white} />
          </Pressable>
        ) : null}
        <View style={styles.headerCopy}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </LinearGradient>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.scroll}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      minHeight: 58,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderBottomWidth: 0,
    },
    backButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    headerCopy: { flex: 1, minWidth: 0 },
    eyebrow: {
      marginBottom: 2,
      color: 'rgba(255,255,255,0.82)',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.4,
    },
    title: { color: palette.white, fontSize: 21, lineHeight: 26, fontWeight: '900' },
    subtitle: { marginTop: 2, color: 'rgba(255,255,255,0.86)', fontSize: 12, lineHeight: 16 },
    scroll: { flex: 1 },
    content: {
      width: '100%',
      maxWidth: 840,
      alignSelf: 'center',
      padding: spacing.md,
      paddingBottom: spacing.xxl + 20,
      gap: spacing.md,
    },
    pressed: { opacity: 0.66 },
  });
}
