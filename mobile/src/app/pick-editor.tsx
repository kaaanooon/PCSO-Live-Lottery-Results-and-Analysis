import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { BottomBannerAd } from '@/components/ads/ad-banner';
import { useGenerationInterstitial } from '@/components/ads/generation-interstitial';
import { GamePicker } from '@/components/game-picker';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { SectionCard } from '@/components/section-card';
import { SegmentedControl } from '@/components/segmented-control';
import { GAME_BY_CODE, formatNumber } from '@/domain/games';
import {
  FREQUENCY_BANDS,
  frequencyBand,
  type FrequencyBand as HeatBand,
} from '@/domain/frequency-bands';
import {
  describeRandomCombination,
  generateRandomCombination,
  parsePick,
  sortDrawsNewestFirst,
} from '@/domain/picks';
import { restoreSavedPicks, type SavedPick } from '@/domain/saved-picks';
import type { DrawGameCode, LogicalGameCode, MatchMode } from '@/domain/types';
import { useDraws } from '@/providers/draws-provider';
import { useAppTheme } from '@/providers/preferences-provider';
import { palette, radius, spacing } from '@/theme/tokens';

const STORAGE_KEY = '@lottolens-ph/picks/v1';
const HEATMAP_SAMPLE_SIZE = 10;

interface HeatmapValue {
  readonly value: number;
  readonly count: number;
  readonly band: HeatBand;
}

export default function PickEditorScreen() {
  const { colors, isDark } = useAppTheme();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const { runBeforeGeneration } = useGenerationInterstitial('pick');
  const requestedId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { draws } = useDraws();
  const [gameCode, setGameCode] = useState<LogicalGameCode>('LOTTO42');
  const rule = GAME_BY_CODE[gameCode];
  const [inputs, setInputs] = useState<string[]>(Array(rule.pickCount).fill(''));
  const [slotCode, setSlotCode] = useState<DrawGameCode>(gameCode);
  const [mode, setMode] = useState<MatchMode>('standard');
  const [savedPicks, setSavedPicks] = useState<SavedPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordFound, setRecordFound] = useState(!requestedId);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationCommentary, setGenerationCommentary] = useState<string | null>(null);
  const generationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationInFlight = useRef(false);
  const generationRequest = useRef(0);

  useEffect(
    () => () => {
      generationRequest.current += 1;
      generationInFlight.current = false;
      if (generationTimer.current) clearTimeout(generationTimer.current);
    },
    [],
  );

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!active) return;
        const restored = value ? restoreSavedPicks(value) : { picks: [], discardedCount: 0 };
        const picks = [...restored.picks];
        setSavedPicks(picks);
        if (restored.discardedCount > 0) {
          setPageError(
            `${restored.discardedCount} invalid saved pick${
              restored.discardedCount === 1 ? ' was' : 's were'
            } ignored.`,
          );
        }

        if (!requestedId) {
          setRecordFound(true);
          return;
        }
        const existing = picks.find((pick) => pick.id === requestedId);
        if (!existing) {
          setRecordFound(false);
          setPageError('This saved pick no longer exists on this device.');
          return;
        }
        setGameCode(existing.gameCode);
        setInputs(existing.numbers.map(String));
        setSlotCode(existing.drawGameCode);
        setMode(existing.mode);
        setRecordFound(true);
      })
      .catch(() => {
        if (active) setPageError('Saved picks could not be loaded on this device.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [requestedId]);

  const modeSegments = useMemo(() => {
    const segments: { label: string; value: MatchMode }[] = [
      { label: 'Standard', value: 'standard' },
    ];
    if (rule.specialPlay) {
      segments.push({
        label: rule.code === '4DL' ? 'PERM' : 'Rambolito',
        value: rule.code === '4DL' ? 'perm' : 'rambolito',
      });
    }
    return segments;
  }, [rule]);

  const comparableDraws = useMemo(
    () =>
      sortDrawsNewestFirst(
        draws.filter(
          (draw) =>
            draw.logicalGameCode === gameCode &&
            (!rule.slots || draw.gameCode === slotCode),
        ),
      ).slice(0, HEATMAP_SAMPLE_SIZE),
    [draws, gameCode, rule.slots, slotCode],
  );

  const heatmapValues = useMemo<readonly HeatmapValue[]>(() => {
    const counts = new Map<number, number>();
    for (let value = rule.minimum; value <= rule.maximum; value += 1) {
      counts.set(value, 0);
    }
    comparableDraws.forEach((draw) => {
      draw.numbers.forEach((number) => counts.set(number, (counts.get(number) ?? 0) + 1));
    });
    const observed = [...counts.values()];
    const minimum = Math.min(...observed);
    const maximum = Math.max(...observed);
    return [...counts.entries()].map(([value, count]) => ({
      value,
      count,
      band: frequencyBand(count, minimum, maximum),
    }));
  }, [comparableDraws, rule.maximum, rule.minimum]);

  const heatmapBandColors = useMemo<
    Readonly<Record<HeatBand, { readonly backgroundColor: string; readonly borderColor: string }>>
  >(
    () => ({
      hot: {
        backgroundColor: isDark ? '#3B1F29' : palette.coral100,
        borderColor: isDark ? colors.danger : palette.coral600,
      },
      warm: {
        backgroundColor: isDark ? '#3A2E16' : palette.gold100,
        borderColor: palette.gold500,
      },
      neutral: {
        backgroundColor: colors.surfaceAlt,
        borderColor: isDark ? colors.border : palette.slate300,
      },
      cool: {
        backgroundColor: isDark ? '#123848' : palette.teal100,
        borderColor: isDark ? colors.primary : palette.teal600,
      },
      cold: {
        backgroundColor: isDark ? '#16253A' : '#E8EEF7',
        borderColor: isDark ? '#6E97C5' : palette.navy800,
      },
    }),
    [colors.border, colors.danger, colors.primary, colors.surfaceAlt, isDark],
  );

  const selectedNumbers = inputs
    .filter((value) => value !== '')
    .map(Number);
  const selectedCounts = selectedNumbers.reduce<Map<number, number>>((counts, value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
    return counts;
  }, new Map());

  const cancelGeneration = () => {
    generationRequest.current += 1;
    generationInFlight.current = false;
    if (generationTimer.current) {
      clearTimeout(generationTimer.current);
      generationTimer.current = null;
    }
    setIsGenerating(false);
  };

  const clearGeneratedCommentary = () => {
    cancelGeneration();
    setGenerationCommentary(null);
  };

  const resetForGame = (nextGameCode: LogicalGameCode) => {
    const nextRule = GAME_BY_CODE[nextGameCode];
    clearGeneratedCommentary();
    setGameCode(nextGameCode);
    setInputs(Array(nextRule.pickCount).fill(''));
    setSlotCode(nextRule.slots?.[0]?.gameCode ?? nextRule.code);
    setMode('standard');
    setEditorError(null);
  };

  const padInputs = (numbers: readonly number[]) => [
    ...numbers.map(String),
    ...Array(Math.max(0, rule.pickCount - numbers.length)).fill(''),
  ];

  const generatePick = () => {
    if (generationInFlight.current) return;
    generationInFlight.current = true;
    const request = generationRequest.current + 1;
    generationRequest.current = request;
    setIsGenerating(true);
    setEditorError(null);
    runBeforeGeneration(() => {
      if (request !== generationRequest.current) return;
      generationTimer.current = setTimeout(() => {
        if (request !== generationRequest.current) return;
        let numbers = generateRandomCombination(rule);
        while (
          (mode === 'rambolito' || mode === 'perm') &&
          new Set(numbers).size === 1
        ) {
          numbers = generateRandomCombination(rule);
        }
        setInputs(numbers.map(String));
        setGenerationCommentary((current) =>
          describeRandomCombination(numbers, rule, comparableDraws, current),
        );
        generationInFlight.current = false;
        setIsGenerating(false);
        generationTimer.current = null;
      }, 650);
    });
  };

  const changeSlot = (nextSlot: DrawGameCode) => {
    clearGeneratedCommentary();
    setSlotCode(nextSlot);
  };

  const changeMode = (nextMode: MatchMode) => {
    clearGeneratedCommentary();
    setMode(nextMode);
  };

  const toggleHeatmap = (enabled: boolean) => {
    setHeatmapEnabled(enabled);
    setEditorError(null);
  };

  const appendHeatmapValue = (value: number) => {
    if (isGenerating) return;
    if (selectedNumbers.length >= rule.pickCount) return;
    if (!rule.repeatsAllowed && selectedNumbers.includes(value)) return;
    setGenerationCommentary(null);
    setInputs(padInputs([...selectedNumbers, value]));
    setEditorError(null);
  };

  const removeLastHeatmapValue = () => {
    if (isGenerating) return;
    if (selectedNumbers.length === 0) return;
    setGenerationCommentary(null);
    setInputs(padInputs(selectedNumbers.slice(0, -1)));
    setEditorError(null);
  };

  const save = async () => {
    if (requestedId && !recordFound) {
      setEditorError('This saved pick can no longer be edited. Return to Pick and try again.');
      return;
    }
    const parsed = parsePick(inputs.join('-'), gameCode);
    if (!parsed.ok) {
      setEditorError(parsed.errors[0]?.message ?? 'Check the entered combination.');
      return;
    }
    if ((mode === 'rambolito' || mode === 'perm') && new Set(parsed.numbers).size === 1) {
      setEditorError(
        `${mode === 'perm' ? 'PERM' : 'Rambolito'} adds no alternate arrangement when every value is identical.`,
      );
      return;
    }

    const existing = requestedId
      ? savedPicks.find((pick) => pick.id === requestedId)
      : undefined;
    const pick: SavedPick = {
      id: existing?.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      gameCode,
      drawGameCode: slotCode,
      numbers: [...parsed.numbers],
      mode,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    const next = existing
      ? savedPicks.map((saved) => (saved.id === existing.id ? pick : saved))
      : [pick, ...savedPicks];
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      router.back();
    } catch {
      setPageError(
        existing
          ? 'The pick could not be updated on this device.'
          : 'The pick could not be saved on this device.',
      );
    }
  };

  const title = requestedId ? 'Edit saved pick' : 'Add a game';

  return (
    <Screen
      title={title}
      eyebrow="PICK EDITOR"
      bottomAd={<BottomBannerAd />}
      backLabel="Back to saved picks"
      onBack={() => router.back()}>
      {pageError ? <Notice tone="danger">{pageError}</Notice> : null}

      {loading ? (
        <SectionCard>
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading saved pick...</Text>
        </SectionCard>
      ) : requestedId && !recordFound ? (
        <SectionCard title="Pick unavailable">
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Return to the Pick tab and select another saved pick.</Text>
          <ActionButton label="Back to saved picks" icon="arrow-back" onPress={() => router.back()} />
        </SectionCard>
      ) : (
        <SectionCard subtitle="Choose the game first, then enter or generate a valid combination.">
          <View style={styles.editorStep}>
            <View style={styles.stepHeading}>
              <Text
                style={[
                  styles.stepNumber,
                  {
                    backgroundColor: isDark ? colors.primary : palette.navy900,
                    color: isDark ? colors.header : palette.white,
                  },
                ]}>
                1
              </Text>
              <Text style={[styles.stepTitle, { color: isDark ? colors.text : palette.navy900 }]}>Choose a game</Text>
            </View>
            <GamePicker value={gameCode} onChange={resetForGame} />
            <Text style={[styles.rule, { color: colors.textMuted }]}>{rule.ruleText}</Text>
          </View>

          <View style={styles.editorStep}>
            <View style={styles.stepHeading}>
              <Text
                style={[
                  styles.stepNumber,
                  {
                    backgroundColor: isDark ? colors.primary : palette.navy900,
                    color: isDark ? colors.header : palette.white,
                  },
                ]}>
                2
              </Text>
              <Text style={[styles.stepTitle, { color: isDark ? colors.text : palette.navy900 }]}>Enter your combination</Text>
            </View>
            {rule.slots ? (
              <View style={styles.controlGroup}>
                <Text style={[styles.controlLabel, { color: isDark ? colors.text : palette.navy900 }]}>Draw time</Text>
                <SegmentedControl
                  accessibilityLabel="Choose draw time"
                  value={slotCode}
                  onChange={changeSlot}
                  segments={rule.slots.map((slot) => ({ label: slot.label, value: slot.gameCode }))}
                />
              </View>
            ) : null}
            {modeSegments.length > 1 ? (
              <View style={styles.controlGroup}>
                <Text style={[styles.controlLabel, { color: isDark ? colors.text : palette.navy900 }]}>Play type</Text>
                <SegmentedControl
                  accessibilityLabel="Choose play type"
                  value={mode}
                  onChange={changeMode}
                  segments={modeSegments}
                />
              </View>
            ) : null}

            <View
              style={[
                styles.modeToggleRow,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}>
              <View style={styles.modeToggleCopy}>
                <Text style={[styles.controlLabel, { color: isDark ? colors.text : palette.navy900 }]}>Hot/cold colors</Text>
                <Text style={[styles.modeToggleHelper, { color: colors.textMuted }]}>Color the number picker using the latest 10 draws.</Text>
              </View>
              <Switch
                accessibilityLabel="Show hot and cold colors"
                value={heatmapEnabled}
                onValueChange={toggleHeatmap}
                trackColor={{
                  false: isDark ? colors.border : palette.slate300,
                  true: isDark ? colors.primary : palette.teal600,
                }}
                thumbColor={isDark ? colors.text : palette.white}
              />
            </View>

            <View style={styles.heatmapPanel}>
              <View style={styles.heatmapSelectionHeader}>
                <View style={styles.combinationSlots}>
                  {inputs.map((value, index) => (
                    <View
                      accessibilityLabel={value ? `Position ${index + 1}, ${formatNumber(Number(value), rule)}` : `Position ${index + 1}, empty`}
                      key={index}
                      style={[
                        styles.combinationSlot,
                        {
                          backgroundColor: colors.input,
                          borderColor: isDark ? colors.border : palette.slate300,
                        },
                        value !== '' && styles.combinationSlotFilled,
                      ]}>
                      <Text
                        style={[
                          styles.combinationSlotText,
                          { color: colors.textMuted },
                          value !== '' && styles.combinationSlotTextFilled,
                        ]}>
                        {value !== '' ? formatNumber(Number(value), rule) : '–'}
                      </Text>
                    </View>
                  ))}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove last selected number"
                  accessibilityState={{ disabled: selectedNumbers.length === 0 || isGenerating }}
                  disabled={selectedNumbers.length === 0 || isGenerating}
                  onPress={removeLastHeatmapValue}
                  style={({ pressed }) => [
                    styles.backspaceButton,
                    {
                      backgroundColor: colors.input,
                      borderColor: isDark ? colors.border : palette.slate300,
                    },
                    (selectedNumbers.length === 0 || isGenerating) && styles.disabled,
                    pressed && styles.pressed,
                  ]}>
                  <Ionicons
                    name="backspace-outline"
                    size={22}
                    color={isDark ? colors.primary : palette.navy900}
                  />
                </Pressable>
              </View>

              <View style={styles.heatmapGrid}>
                {heatmapValues.map((item) => {
                  const selectedCount = selectedCounts.get(item.value) ?? 0;
                  const additionsFull = selectedNumbers.length >= rule.pickCount;
                  const duplicateBlocked = !rule.repeatsAllowed && selectedCount > 0;
                  const disabled = isGenerating || additionsFull || duplicateBlocked;
                  return (
                    <Pressable
                      key={item.value}
                      accessibilityRole="button"
                      accessibilityLabel={heatmapEnabled
                        ? `${formatNumber(item.value, rule)}, ${item.band}, ${item.count} appearances${selectedCount ? `, selected ${selectedCount} times` : ''}`
                        : `${formatNumber(item.value, rule)}${selectedCount ? `, selected ${selectedCount} times` : ''}`}
                      accessibilityState={{ disabled, selected: selectedCount > 0 }}
                      disabled={disabled}
                      onPress={() => appendHeatmapValue(item.value)}
                      style={({ pressed }) => [
                        styles.heatmapCell,
                        heatmapEnabled
                          ? heatmapBandColors[item.band]
                          : {
                              backgroundColor: colors.surfaceAlt,
                              borderColor: isDark ? colors.border : palette.slate300,
                            },
                        selectedCount > 0 && styles.heatmapSelected,
                        selectedCount > 0 && {
                          borderColor: isDark ? colors.primary : palette.navy950,
                        },
                        disabled && styles.heatmapDisabled,
                        pressed && !disabled && styles.pressed,
                      ]}>
                      <Text
                        style={[
                          styles.heatmapNumber,
                          { color: isDark ? colors.text : palette.navy950 },
                        ]}>
                        {formatNumber(item.value, rule)}
                      </Text>
                      {heatmapEnabled ? (
                        <Text style={[styles.heatmapCount, { color: colors.textMuted }]}>{item.count}x</Text>
                      ) : null}
                      {selectedCount > 0 ? (
                        <View
                          style={[
                            styles.selectionBadge,
                            { backgroundColor: isDark ? colors.primary : palette.navy950 },
                          ]}>
                          <Text
                            style={[
                              styles.selectionBadgeText,
                              { color: isDark ? colors.header : palette.white },
                            ]}>
                            {selectedCount}
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              {heatmapEnabled ? (
                <>
                <View style={styles.legendRow}>
                  {FREQUENCY_BANDS.map((band) => (
                    <View key={band} style={styles.legendItem}>
                      <View style={[styles.legendDot, heatmapBandColors[band]]} />
                      <Text style={[styles.legendText, { color: colors.textMuted }]}>{band}</Text>
                    </View>
                  ))}
                </View>
                <Text style={[styles.heatmapHelper, { color: colors.textMuted }]}>
                  Colors show relative frequency in the latest {comparableDraws.length} comparable draw{comparableDraws.length === 1 ? '' : 's'}.
                </Text>
                </>
              ) : null}
            </View>
            <View style={styles.inputSummary}>
              <Text style={[styles.inputHint, { color: colors.textMuted }]}>
                Allowed: {rule.minimum}-{rule.maximum}{rule.repeatsAllowed ? ' · repeats allowed' : ' · unique numbers only'}
              </Text>
            </View>
            {editorError ? (
              <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>
                {editorError}
              </Text>
            ) : null}

            {isGenerating || generationCommentary ? (
              <View style={[styles.generationStatus, { backgroundColor: colors.surfaceAlt }]}>
                {isGenerating ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Ionicons color={colors.primary} name="sparkles-outline" size={18} />
                )}
                <Text style={[styles.generationStatusText, { color: colors.text }]}>
                  {isGenerating
                    ? 'Generating best possible combination...'
                    : generationCommentary}
                </Text>
              </View>
            ) : null}

            <View style={styles.editorActions}>
              <ActionButton
                disabled={isGenerating}
                label={isGenerating ? 'Generating...' : 'Generate pick'}
                icon="sparkles-outline"
                variant="secondary"
                onPress={generatePick}
                style={styles.editorAction}
              />
              <ActionButton
                disabled={isGenerating}
                label={requestedId ? 'Update' : 'Save'}
                icon="save-outline"
                onPress={() => void save()}
                style={styles.editorAction}
              />
            </View>
          </View>
        </SectionCard>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.65 },
  loadingText: { color: palette.slate600, fontSize: 13, lineHeight: 19 },
  editorStep: { gap: spacing.md },
  stepHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    color: palette.white,
    backgroundColor: palette.navy900,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 11,
    fontWeight: '900',
  },
  stepTitle: { color: palette.navy900, fontSize: 14, fontWeight: '900' },
  rule: { color: palette.slate600, fontSize: 12, lineHeight: 18 },
  controlGroup: { gap: spacing.sm },
  controlLabel: { color: palette.navy900, fontSize: 12, fontWeight: '900' },
  modeToggleRow: {
    minHeight: 54,
    padding: spacing.sm,
    paddingLeft: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: palette.slate100,
  },
  modeToggleCopy: { flex: 1 },
  modeToggleHelper: { color: palette.slate600, fontSize: 10, lineHeight: 15, marginTop: 2 },
  heatmapPanel: { gap: spacing.md },
  heatmapSelectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  combinationSlots: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  combinationSlot: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.slate300,
    borderRadius: radius.pill,
    backgroundColor: palette.white,
  },
  combinationSlotFilled: { borderColor: palette.blue600, backgroundColor: palette.blue600 },
  combinationSlotText: { color: palette.slate500, fontSize: 12, fontWeight: '900' },
  combinationSlotTextFilled: { color: palette.white },
  backspaceButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.slate300,
    borderRadius: radius.md,
    backgroundColor: palette.white,
  },
  disabled: { opacity: 0.35 },
  heatmapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  heatmapCell: {
    position: 'relative',
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.slate300,
    borderRadius: radius.sm,
    backgroundColor: palette.slate100,
  },
  heatmapSelected: { borderWidth: 3, borderColor: palette.navy950 },
  heatmapDisabled: { opacity: 0.55 },
  heatmapNumber: { color: palette.navy950, fontSize: 13, fontWeight: '900' },
  heatmapCount: { color: palette.slate600, fontSize: 8, fontWeight: '700', marginTop: 1 },
  selectionBadge: {
    position: 'absolute',
    top: -5,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: palette.navy950,
  },
  selectionBadgeText: { color: palette.white, fontSize: 9, fontWeight: '900' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: palette.slate300,
    borderRadius: 3,
    backgroundColor: palette.slate100,
  },
  legendText: { color: palette.slate600, fontSize: 9, textTransform: 'capitalize' },
  heatmapHelper: { color: palette.slate600, fontSize: 10, lineHeight: 15 },
  inputSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  inputHint: { color: palette.slate600, fontSize: 11 },
  error: { color: palette.coral600, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  generationStatus: {
    minHeight: 52,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
  },
  generationStatusText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  editorActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  editorAction: { flexGrow: 1, flexBasis: 190 },
});
