import { StyleSheet, Text, View } from 'react-native';

import type { GameRule } from '@/domain/types';
import { formatNumber } from '@/domain/games';
import { palette, radius, spacing } from '@/theme/tokens';

export function NumberBalls({ numbers, rule, compact = false }: { numbers: readonly number[]; rule: GameRule; compact?: boolean }) {
  return (
    <View
      accessibilityLabel={`Combination ${numbers.map((number) => formatNumber(number, rule)).join(', ')}`}
      style={styles.row}>
      {numbers.map((number, index) => (
        <View
          key={`${index}-${number}`}
          style={[
            styles.ball,
            compact && styles.compactBall,
          ]}>
          <Text style={[styles.text, compact && styles.compactText]}>{formatNumber(number, rule)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  ball: {
    minWidth: 42,
    height: 42,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: palette.blue600,
  },
  compactBall: { minWidth: 34, height: 34, paddingHorizontal: 6 },
  text: { color: palette.white, fontSize: 15, fontWeight: '900' },
  compactText: { fontSize: 12 },
});
