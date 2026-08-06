import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useAppTheme } from '@/providers/preferences-provider';
import { radius, spacing } from '@/theme/tokens';

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      {children}
      {error ? (
        <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function AppTextInput(props: TextInputProps) {
  const { colors } = useAppTheme();

  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      selectionColor={colors.primary}
      {...props}
      style={[
        styles.input,
        { color: colors.text, backgroundColor: colors.input, borderColor: colors.border },
        props.style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  field: { gap: 5 },
  label: { fontSize: 12, fontWeight: '900' },
  hint: { fontSize: 11, lineHeight: 16 },
  error: { fontSize: 11, lineHeight: 16, fontWeight: '700' },
  input: {
    minHeight: 46,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    fontSize: 15,
  },
});
