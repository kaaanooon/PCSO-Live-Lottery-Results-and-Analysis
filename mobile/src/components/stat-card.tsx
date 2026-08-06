import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/providers/preferences-provider';
import { palette, radius, spacing } from '@/theme/tokens';

export function StatCard({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'teal' | 'gold' }) {
  const { isDark, colors } = useAppTheme();
  const backgroundColor = tone === 'teal'
    ? isDark ? '#113452' : palette.teal100
    : tone === 'gold'
      ? isDark ? '#3A2C0C' : palette.gold100
      : colors.surfaceAlt;
  return (
    <View style={[styles.card, { backgroundColor }]}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 130,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.slate100,
  },
  label: { color: palette.slate600, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  value: { color: palette.navy900, fontSize: 20, fontWeight: '900', marginTop: 3 },
});
