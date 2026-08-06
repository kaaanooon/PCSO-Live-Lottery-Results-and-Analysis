import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/providers/preferences-provider';
import { radius, spacing } from '@/theme/tokens';

export type Segment<T extends string> = { label: string; value: T };

export function SegmentedControl<T extends string>({
  value,
  onChange,
  segments,
  accessibilityLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  segments: Segment<T>[];
  accessibilityLabel: string;
}) {
  const { colors } = useAppTheme();

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tablist"
      style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(segment.value)}
            style={({ pressed }) => [
              styles.button,
              active && { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.label, { color: active ? colors.surface : colors.textMuted }]}>{segment.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 3,
  },
  button: {
    flex: 1,
    minHeight: 42,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  pressed: { opacity: 0.75 },
  label: { fontSize: 13, fontWeight: '800' },
});
