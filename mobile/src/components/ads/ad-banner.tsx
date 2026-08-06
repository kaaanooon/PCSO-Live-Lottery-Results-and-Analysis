import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAds } from '@/providers/ads-context';
import { useAppTheme } from '@/providers/preferences-provider';

export interface BannerAdProps {
  readonly style?: StyleProp<ViewStyle>;
}

interface PreviewBannerProps extends BannerAdProps {
  readonly placement: 'top' | 'bottom';
}

function PreviewBanner({ placement, style }: PreviewBannerProps) {
  const { adsEnabled } = useAds();
  const { colors } = useAppTheme();
  if (!adsEnabled) return null;

  return (
    <View
      accessibilityLabel={`${placement} advertisement preview`}
      style={[
        styles.preview,
        {
          backgroundColor: colors.surfaceAlt,
          borderColor: colors.border,
        },
        style,
      ]}>
      <Text style={[styles.label, { color: colors.textMuted }]}>ADVERTISEMENT</Text>
      <Text style={[styles.previewText, { color: colors.text }]}>Advertisement preview</Text>
    </View>
  );
}

export function TopBannerAd(props: BannerAdProps) {
  return <PreviewBanner {...props} placement="top" />;
}

export function BottomBannerAd(props: BannerAdProps) {
  return <PreviewBanner {...props} placement="bottom" />;
}

const styles = StyleSheet.create({
  preview: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 8,
    width: '100%',
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    lineHeight: 12,
  },
  previewText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 2,
  },
});
