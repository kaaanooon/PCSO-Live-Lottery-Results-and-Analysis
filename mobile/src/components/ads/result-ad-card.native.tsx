import { useEffect, useState } from 'react';
import { Image, InteractionManager, Platform, StyleSheet, Text, View } from 'react-native';
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
  TestIds,
} from 'react-native-google-mobile-ads';

import { useAds } from '@/providers/ads-context';
import { useAppTheme } from '@/providers/preferences-provider';
import { radius, shadow, spacing } from '@/theme/tokens';

export interface ResultAdCardProps {
  readonly placement?: 'results' | 'history';
}

function productionOrTestId(value: string | undefined): string {
  const candidate = value?.trim();
  return !__DEV__ && candidate?.startsWith('ca-app-pub-') ? candidate : TestIds.NATIVE;
}

const RESULTS_AD_UNIT_ID = productionOrTestId(
  Platform.select({
    android: process.env.EXPO_PUBLIC_ADMOB_NATIVE_RESULTS_ANDROID_ID,
    ios: process.env.EXPO_PUBLIC_ADMOB_NATIVE_RESULTS_IOS_ID,
  }) ?? process.env.EXPO_PUBLIC_ADMOB_NATIVE_RESULTS_ID,
);
const HISTORY_AD_UNIT_ID = productionOrTestId(
  Platform.select({
    android: process.env.EXPO_PUBLIC_ADMOB_NATIVE_HISTORY_ANDROID_ID,
    ios: process.env.EXPO_PUBLIC_ADMOB_NATIVE_HISTORY_IOS_ID,
  }) ?? process.env.EXPO_PUBLIC_ADMOB_NATIVE_HISTORY_ID,
);

function unitIdFor(placement: NonNullable<ResultAdCardProps['placement']>): string {
  return placement === 'history' ? HISTORY_AD_UNIT_ID : RESULTS_AD_UNIT_ID;
}

export function ResultAdCard({ placement = 'results' }: ResultAdCardProps) {
  const { ready, canRequestAds, adsEnabled } = useAds();
  const { colors, isDark } = useAppTheme();
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);

  useEffect(() => {
    let active = true;
    let loadedAd: NativeAd | null = null;

    if (!ready || !canRequestAds || !adsEnabled) {
      return () => {
        active = false;
      };
    }

    const task = InteractionManager.runAfterInteractions(() => {
      if (!active) return;
      void NativeAd.createForAdRequest(unitIdFor(placement), {
        requestAgent: 'PCSO Lotto Results & Analysis',
        startVideoMuted: true,
      })
        .then((ad) => {
          if (!active) {
            ad.destroy();
            return;
          }
          loadedAd = ad;
          setNativeAd(ad);
        })
        .catch(() => {
          // A failed ad request should never interrupt access to lottery results.
        });
    });

    return () => {
      active = false;
      task.cancel();
      loadedAd?.destroy();
    };
  }, [adsEnabled, canRequestAds, placement, ready]);

  if (!ready || !adsEnabled || !nativeAd) return null;

  return (
    <NativeAdView
      accessibilityLabel="Advertisement"
      nativeAd={nativeAd}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        isDark && { shadowColor: colors.overlay, shadowOpacity: 0.42 },
      ]}>
      <Text style={[styles.label, { color: colors.textMuted }]}>ADVERTISEMENT</Text>
      <View style={styles.content}>
        <NativeMediaView resizeMode="cover" style={styles.media} />
        <View style={styles.copy}>
          <View style={styles.headingRow}>
            {nativeAd.icon ? (
              <NativeAsset assetType={NativeAssetType.ICON}>
                <Image source={{ uri: nativeAd.icon.url }} style={styles.icon} />
              </NativeAsset>
            ) : null}
            <View style={styles.headingCopy}>
              <NativeAsset assetType={NativeAssetType.HEADLINE}>
                <Text numberOfLines={2} style={[styles.headline, { color: colors.text }]}>
                  {nativeAd.headline}
                </Text>
              </NativeAsset>
              {nativeAd.advertiser ? (
                <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                  <Text numberOfLines={1} style={[styles.advertiser, { color: colors.textMuted }]}>
                    {nativeAd.advertiser}
                  </Text>
                </NativeAsset>
              ) : null}
            </View>
          </View>
          <NativeAsset assetType={NativeAssetType.BODY}>
            <Text numberOfLines={2} style={[styles.body, { color: colors.textMuted }]}>
              {nativeAd.body}
            </Text>
          </NativeAsset>
          <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
            <View style={[styles.action, { backgroundColor: colors.primary }]}>
              <Text numberOfLines={1} style={styles.actionText}>{nativeAd.callToAction}</Text>
            </View>
          </NativeAsset>
        </View>
      </View>
    </NativeAdView>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 132,
    padding: spacing.sm,
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow,
  },
  label: { fontSize: 8, lineHeight: 10, fontWeight: '800', letterSpacing: 0.7 },
  content: { minHeight: 104, flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  media: { width: 104, minHeight: 104, borderRadius: radius.md, overflow: 'hidden' },
  copy: { flex: 1, minWidth: 0, justifyContent: 'space-between', gap: 3 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headingCopy: { flex: 1, minWidth: 0 },
  icon: { width: 32, height: 32, borderRadius: radius.sm },
  headline: { fontSize: 13, lineHeight: 16, fontWeight: '900' },
  advertiser: { marginTop: 1, fontSize: 9, lineHeight: 12, fontWeight: '700' },
  body: { fontSize: 9, lineHeight: 13 },
  action: {
    minHeight: 30,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  actionText: { color: '#FFFFFF', fontSize: 10, lineHeight: 13, fontWeight: '900' },
});
