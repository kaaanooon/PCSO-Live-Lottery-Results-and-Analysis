import { ScrollView, Pressable, StyleSheet, Text } from 'react-native';

import { GAME_RULES } from '@/domain/games';
import type { LogicalGameCode } from '@/domain/types';
import { useAppTheme } from '@/providers/preferences-provider';
import { radius, spacing } from '@/theme/tokens';

export function GamePicker({ value, onChange }: { value: LogicalGameCode; onChange: (value: LogicalGameCode) => void }) {
  const { colors } = useAppTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityLabel="Choose a lottery game">
      {GAME_RULES.map((game) => {
        const active = game.code === value;
        return (
          <Pressable
            key={game.code}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(game.code)}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border },
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.label, { color: active ? colors.surface : colors.text }]}>{game.shortName}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: 2 },
  chip: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pressed: { opacity: 0.75 },
  label: { fontSize: 12, fontWeight: '800' },
});
