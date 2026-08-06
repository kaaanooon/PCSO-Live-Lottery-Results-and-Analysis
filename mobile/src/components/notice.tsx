import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/providers/preferences-provider';
import { palette, radius, spacing } from '@/theme/tokens';

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' | 'danger' }) {
  const { colors } = useAppTheme();
  const color = tone === 'warning' ? palette.gold500 : tone === 'danger' ? colors.danger : colors.primary;
  return (
    <View style={[styles.notice, { borderLeftColor: color, backgroundColor: colors.surfaceAlt }]}>
      <Ionicons name={tone === 'warning' ? 'warning-outline' : tone === 'danger' ? 'alert-circle-outline' : 'information-circle-outline'} size={18} color={color} />
      <Text style={[styles.text, { color: colors.textMuted }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderRadius: radius.sm,
    backgroundColor: palette.slate100,
  },
  text: { flex: 1, color: palette.slate700, fontSize: 12, lineHeight: 18 },
});
