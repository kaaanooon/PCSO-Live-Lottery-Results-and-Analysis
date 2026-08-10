import { StyleSheet, Text, View } from 'react-native';

import { useAds } from '@/providers/ads-context';
import { useAppTheme } from '@/providers/preferences-provider';
import { radius, shadow, spacing } from '@/theme/tokens';

export interface ResultAdCardProps {
  readonly placement?: 'results' | 'history';
}

/** Responsive localhost preview. Native builds replace this file with the SDK-backed card. */
export function ResultAdCard({ placement = 'results' }: ResultAdCardProps) {
  const { ready, adsEnabled } = useAds();
  const { colors } = useAppTheme();

  if (!ready || !adsEnabled) return null;

  return (
    <View
      accessibilityLabel={`${placement} advertisement preview`}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}>
      <View style={[styles.previewArt, { backgroundColor: colors.surfaceAlt }]}>
        <Text style={[styles.previewMark, { color: colors.primary }]}>AD</Text>
      </View>
      <View style={styles.copy}>
        <Text style={[styles.label, { color: colors.textMuted }]}>ADVERTISEMENT</Text>
        <Text style={[styles.headline, { color: colors.text }]}>Advertisement preview</Text>
        <Text numberOfLines={2} style={[styles.body, { color: colors.textMuted }]}>
          Native sponsored content will appear in this card on Android and iOS.
        </Text>
      </View>
      <View style={[styles.action, { backgroundColor: colors.primary }]}>
        <Text style={styles.actionText}>Learn more</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 116,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    ...shadow,
  },
  previewArt: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  previewMark: { fontSize: 14, fontWeight: '900', letterSpacing: 0.8 },
  copy: { flex: 1, minWidth: 0 },
  label: { fontSize: 8, lineHeight: 11, fontWeight: '800', letterSpacing: 0.7 },
  headline: { marginTop: 2, fontSize: 14, lineHeight: 18, fontWeight: '900' },
  body: { marginTop: 3, fontSize: 10, lineHeight: 14 },
  action: {
    minHeight: 34,
    maxWidth: 90,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  actionText: { color: '#FFFFFF', fontSize: 10, lineHeight: 13, fontWeight: '900' },
});
