import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/providers/preferences-provider';
import { radius, spacing } from '@/theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function ActionButton({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  const { colors } = useAppTheme();
  const isDisabled = disabled || loading;
  const foreground = variant === 'primary' ? colors.surface : variant === 'danger' ? colors.danger : colors.text;
  const backgroundColor = variant === 'primary'
    ? colors.primary
    : variant === 'secondary' || variant === 'danger'
      ? colors.surface
      : 'transparent';
  const borderColor = variant === 'primary'
    ? colors.primary
    : variant === 'danger'
      ? colors.danger
      : variant === 'secondary'
        ? colors.border
        : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor, borderColor },
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={foreground} size="small" />
      ) : icon ? (
        <Ionicons name={icon} size={17} color={foreground} />
      ) : null}
      <Text style={[styles.label, { color: foreground }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
  },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
  label: { fontSize: 13, fontWeight: '900' },
});
