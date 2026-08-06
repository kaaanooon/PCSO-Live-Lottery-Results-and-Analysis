import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/providers/preferences-provider';
import { palette, radius, shadow, spacing } from '@/theme/tokens';

type SectionCardProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  style?: ViewStyle;
}>;

export function SectionCard({ title, subtitle, right, style, children }: SectionCardProps) {
  const { colors } = useAppTheme();
  return (
    <View style={[
      styles.card,
      { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.overlay },
      style,
    ]}>
      {title || subtitle || right ? (
        <View style={styles.header}>
          <View style={styles.copy}>
            {title ? <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text> : null}
            {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.white,
    borderColor: palette.slate200,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  copy: { flex: 1 },
  title: { color: palette.navy900, fontSize: 17, lineHeight: 22, fontWeight: '900' },
  subtitle: { color: palette.slate600, fontSize: 12, lineHeight: 17, marginTop: 2 },
});
