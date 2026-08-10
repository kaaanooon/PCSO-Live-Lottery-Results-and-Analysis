import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Notice } from '@/components/notice';
import { NumberBalls } from '@/components/number-balls';
import { Screen } from '@/components/screen';
import { SectionCard } from '@/components/section-card';
import { GAME_BY_CODE } from '@/domain/games';
import { comparePick, sortDrawsNewestFirst } from '@/domain/picks';
import { restoreSavedPicks, type SavedPick } from '@/domain/saved-picks';
import type { LogicalGameCode, LotteryDraw } from '@/domain/types';
import { formatDrawDate, formatDrawTime } from '@/lib/format';
import { useGuardedNavigation } from '@/lib/use-guarded-navigation';
import { useDraws } from '@/providers/draws-provider';
import { useAppTheme } from '@/providers/preferences-provider';
import { palette, radius, shadow, spacing } from '@/theme/tokens';

const STORAGE_KEY = '@lottolens-ph/picks/v1';

const GAME_LOGOS: Readonly<Record<LogicalGameCode, number>> = {
  UL58: require('@/assets/game-logos/658.png'),
  GL55: require('@/assets/game-logos/655.png'),
  SL49: require('@/assets/game-logos/649.png'),
  ML45: require('@/assets/game-logos/645.png'),
  LOTTO42: require('@/assets/game-logos/642.png'),
  '6DL': require('@/assets/game-logos/6dl.webp'),
  '4DL': require('@/assets/game-logos/4dl.webp'),
  '3DL': require('@/assets/game-logos/3dl.webp'),
  '2DL': require('@/assets/game-logos/2dl.webp'),
};

function overlapCount(left: readonly number[], right: readonly number[]): number {
  const remaining = [...right];
  let count = 0;
  left.forEach((number) => {
    const index = remaining.indexOf(number);
    if (index >= 0) {
      count += 1;
      remaining.splice(index, 1);
    }
  });
  return count;
}

function latestComparableDraw(draws: readonly LotteryDraw[], pick: SavedPick): LotteryDraw | null {
  return sortDrawsNewestFirst(
    draws.filter(
      (draw) =>
        draw.logicalGameCode === pick.gameCode &&
        (pick.drawGameCode === pick.gameCode || draw.gameCode === pick.drawGameCode),
    ),
  )[0] ?? null;
}

function PickResult({
  pick,
  draws,
  onEdit,
  onDelete,
}: {
  pick: SavedPick;
  draws: readonly LotteryDraw[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { colors, isDark } = useAppTheme();
  const rule = GAME_BY_CODE[pick.gameCode];
  const latest = latestComparableDraw(draws, pick);
  const comparison = latest ? comparePick(pick.numbers, latest.numbers, pick.gameCode, pick.mode) : null;
  const exactPositions = latest
    ? pick.numbers.filter((number, index) => number === latest.numbers[index]).length
    : 0;
  const shared = latest ? overlapCount(pick.numbers, latest.numbers) : 0;
  const potential = Boolean(comparison?.isWin);
  const special = pick.mode === 'rambolito' || pick.mode === 'perm';
  const slotLabel = rule.slots?.find((slot) => slot.gameCode === pick.drawGameCode)?.label;
  const playLabel = special ? pick.mode.toUpperCase() : 'Standard';
  const statusLabel = potential ? 'MATCH' : latest ? 'CHECKED' : 'PENDING';
  const evenCount = pick.numbers.filter((number) => number % 2 === 0).length;
  const oddCount = pick.numbers.length - evenCount;
  const midpoint = Math.floor((rule.minimum + rule.maximum) / 2);
  const lowCount = pick.numbers.filter((number) => number <= midpoint).length;
  const highCount = pick.numbers.length - lowCount;
  const matchSurface = isDark ? '#123847' : palette.teal100;
  const matchBorder = isDark ? colors.primary : palette.teal600;
  const matchText = isDark ? colors.primary : palette.teal700;
  const secondaryText = isDark ? colors.textMuted : palette.slate700;
  const controlAccent = isDark ? colors.primary : palette.navy900;

  return (
    <View
      style={[
        styles.pickCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.overlay,
        },
      ]}>
      <View style={styles.pickTopRow}>
        <View style={styles.logoColumn}>
          <Image source={GAME_LOGOS[pick.gameCode]} contentFit="contain" style={styles.logo} />
        </View>

        <View style={styles.pickCenter}>
          <Text
            accessibilityRole="header"
            style={[styles.gameName, { color: isDark ? colors.text : palette.navy950 }]}>
            {rule.name}
          </Text>
          <Text style={[styles.pickMeta, { color: colors.danger }]}>
            {slotLabel ? `${slotLabel} · ` : ''}{playLabel}
          </Text>
          <Text style={[styles.pickLabel, { color: colors.textMuted }]}>Your pick</Text>
          <NumberBalls numbers={pick.numbers} rule={rule} compact />
          <Text
            accessibilityLabel={`${evenCount} even, ${oddCount} odd, ${lowCount} low, ${highCount} high`}
            style={[styles.profileText, { color: secondaryText }]}>
            {evenCount}-{oddCount}-{lowCount}-{highCount}
          </Text>
        </View>

        <View style={styles.pickRight}>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: potential ? matchSurface : colors.surfaceAlt,
                borderColor: potential ? matchBorder : colors.border,
              },
            ]}>
            <Ionicons
              name={potential ? 'checkmark-circle' : latest ? 'checkmark-done' : 'time-outline'}
              size={13}
              color={potential ? matchText : secondaryText}
            />
            <Text
              style={[
                styles.statusText,
                { color: potential ? matchText : secondaryText },
              ]}>
              {statusLabel}
            </Text>
          </View>
          <View style={styles.cardActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit ${rule.name} saved pick`}
              onPress={onEdit}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <Ionicons name="create-outline" size={18} color={controlAccent} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delete ${rule.name} saved pick`}
              onPress={onDelete}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.verdict,
          {
            backgroundColor: potential ? matchSurface : colors.surfaceAlt,
            borderColor: potential ? matchBorder : colors.border,
          },
        ]}>
        <Text style={[styles.verdictTitle, { color: isDark ? colors.text : palette.navy900 }]}>
          {potential ? 'Potential full match' : latest ? 'No full match in the latest comparable draw' : 'Waiting for a comparable result'}
        </Text>
        {latest ? (
          <Text style={[styles.verdictText, { color: secondaryText }]}>
            Checked against {formatDrawDate(latest.date)} at {formatDrawTime(latest.time)}.{' '}
            {rule.ordered && !special
              ? `${exactPositions} of ${rule.pickCount} positions matched.`
              : `${shared} of ${rule.pickCount} values matched.`}
          </Text>
        ) : (
          <Text style={[styles.verdictText, { color: secondaryText }]}>No published result is available for this game and draw slot yet.</Text>
        )}
        {potential ? (
          <Text style={[styles.verify, { color: matchText }]}>
            Verify the printed ticket and play type with PCSO.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function PickScreen() {
  const { colors, isDark } = useAppTheme();
  const { draws } = useDraws();
  const { navigate } = useGuardedNavigation();
  const [savedPicks, setSavedPicks] = useState<SavedPick[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setStorageReady(false);
      setPageError(null);
      void AsyncStorage.getItem(STORAGE_KEY)
        .then((value) => {
          if (!active) return;
          if (!value) {
            setSavedPicks([]);
            return;
          }
          const restored = restoreSavedPicks(value);
          setSavedPicks([...restored.picks]);
          if (restored.discardedCount > 0) {
            setPageError(
              `${restored.discardedCount} invalid saved pick${
                restored.discardedCount === 1 ? ' was' : 's were'
              } ignored.`,
            );
          }
        })
        .catch(() => {
          if (active) setPageError('Saved picks could not be loaded on this device.');
        })
        .finally(() => {
          if (active) setStorageReady(true);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const remove = async (id: string) => {
    const next = savedPicks.filter((pick) => pick.id !== id);
    setSavedPicks(next);
    setPageError(null);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      setPageError('The pick was removed here, but device storage could not be updated.');
    }
  };

  return (
    <Screen scrollToTopOnFocus title="Pick">
      <View style={styles.savedHeading}>
        <View style={styles.savedHeadingCopy}>
          <Text style={[styles.savedTitle, { color: isDark ? colors.text : palette.navy900 }]}>Saved picks</Text>
          <Text
            style={[
              styles.savedCount,
              { backgroundColor: colors.primary, color: isDark ? colors.header : palette.white },
            ]}>
            {savedPicks.length}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a game"
          onPress={() => navigate('/pick-editor')}
          style={({ pressed }) => [
            styles.addButton,
            {
              backgroundColor: colors.surface,
              borderColor: isDark ? colors.border : palette.slate300,
            },
            pressed && styles.pressed,
          ]}>
          <Ionicons name="add" size={17} color={isDark ? colors.primary : palette.navy900} />
          <Text style={[styles.addButtonText, { color: isDark ? colors.text : palette.navy900 }]}>Add a game</Text>
        </Pressable>
      </View>

      {pageError ? <Notice tone="danger">{pageError}</Notice> : null}

      {storageReady && savedPicks.length === 0 ? (
        <SectionCard>
          <View style={styles.empty}>
            <Ionicons name="ticket-outline" size={30} color={isDark ? colors.textMuted : palette.slate500} />
            <Text style={[styles.emptyTitle, { color: isDark ? colors.text : palette.navy900 }]}>No saved picks yet</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Tap Add a game to enter a combination, save it, and compare it with published results.
            </Text>
          </View>
        </SectionCard>
      ) : null}

      {savedPicks.map((pick) => (
        <PickResult
          key={pick.id}
          pick={pick}
          draws={draws}
          onEdit={() => navigate({ pathname: '/pick-editor', params: { id: pick.id } })}
          onDelete={() => void remove(pick.id)}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  savedHeading: {
    minHeight: 44,
    paddingHorizontal: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  savedHeadingCopy: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  savedTitle: { color: palette.navy900, fontSize: 20, fontWeight: '900' },
  savedCount: {
    minWidth: 26,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
    color: palette.white,
    backgroundColor: palette.teal700,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '900',
  },
  addButton: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.slate300,
    backgroundColor: palette.white,
  },
  addButtonText: { color: palette.navy900, fontSize: 11, fontWeight: '900' },
  pressed: { opacity: 0.65 },
  pickCard: {
    padding: spacing.md,
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.slate200,
    backgroundColor: palette.white,
    ...shadow,
  },
  pickTopRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.md },
  logoColumn: { width: 54, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 54, height: 54 },
  pickCenter: { flex: 1, minWidth: 0, gap: 6 },
  gameName: { color: palette.navy950, fontSize: 15, lineHeight: 19, fontWeight: '900' },
  pickMeta: { color: palette.coral600, fontSize: 10, fontWeight: '900' },
  pickLabel: { color: palette.slate600, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  profileText: { color: palette.slate700, fontSize: 10, fontWeight: '800' },
  pickRight: { width: 82, alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.sm },
  statusBadge: {
    minHeight: 25,
    paddingHorizontal: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: palette.slate100,
  },
  statusText: { color: palette.slate700, fontSize: 8, fontWeight: '900' },
  cardActions: { flexDirection: 'row', gap: 2 },
  iconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  verdict: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, gap: 4 },
  verdictTitle: { color: palette.navy900, fontSize: 13, fontWeight: '900' },
  verdictText: { color: palette.slate700, fontSize: 12, lineHeight: 18 },
  verify: { color: palette.teal700, fontSize: 11, fontWeight: '900' },
  empty: { alignItems: 'center', paddingVertical: spacing.md, gap: spacing.sm },
  emptyTitle: { color: palette.navy900, fontSize: 15, fontWeight: '900' },
  emptyText: { color: palette.slate600, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
