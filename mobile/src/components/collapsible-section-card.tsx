import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/providers/preferences-provider';
import { palette, radius, shadow, spacing } from '@/theme/tokens';

export type CollapsibleSectionCardProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  defaultCollapsed?: boolean;
  right?: ReactNode;
}>;

export function CollapsibleSectionCard({
  title,
  subtitle,
  defaultCollapsed = false,
  right,
  children,
}: CollapsibleSectionCardProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const expanded = !collapsed;
  const { colors } = useAppTheme();

  return (
    <View style={[
      styles.card,
      { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.overlay },
    ]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}. ${expanded ? 'Collapse' : 'Expand'} section`}
          accessibilityState={{ expanded }}
          onPress={() => setCollapsed((value) => !value)}
          style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
          <View style={styles.copy}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text>
            {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
          </View>
          <View style={[styles.chevron, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={19}
              color={colors.primary}
            />
          </View>
        </Pressable>

        {/* Kept outside the toggle so interactive right content is never nested. */}
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>

      {expanded ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: palette.slate200,
    borderRadius: radius.lg,
    backgroundColor: palette.white,
    ...shadow,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  toggle: {
    minHeight: 44,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  pressed: { opacity: 0.66 },
  copy: { flex: 1 },
  title: { color: palette.navy900, fontSize: 17, lineHeight: 22, fontWeight: '900' },
  subtitle: { color: palette.slate600, fontSize: 12, lineHeight: 17, marginTop: 2 },
  chevron: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: palette.slate100,
  },
  right: { minHeight: 44, alignItems: 'flex-end', justifyContent: 'flex-start' },
  content: { gap: spacing.md },
});
