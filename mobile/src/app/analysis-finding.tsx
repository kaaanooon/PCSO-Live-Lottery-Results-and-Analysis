import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { useGenerationInterstitial } from '@/components/ads/generation-interstitial';
import {
  DrawScatterChart,
  DrawTotalsAreaChart,
  FrequencyTrendChart,
  GapDetailsTable,
  LowHighDistributionChart,
  ParityDonutChart,
  PositionFrequencyChart,
} from '@/components/analysis-charts';
import { Notice } from '@/components/notice';
import { NumberBalls } from '@/components/number-balls';
import { Screen } from '@/components/screen';
import { SectionCard } from '@/components/section-card';
import { StatCard } from '@/components/stat-card';
import { analyzeGame, type GameAnalysis } from '@/domain/analysis';
import {
  ANALYSIS_FINDINGS,
  isAnalysisFinding,
  isAnalysisSlotForGame,
  latestAnalysisDraws,
  type AnalysisFinding,
} from '@/domain/analysis-navigation';
import {
  FREQUENCY_BANDS,
  rankFrequencyRows,
  type FrequencyBand,
} from '@/domain/frequency-bands';
import { GAME_BY_CODE, formatNumber, isLogicalGameCode } from '@/domain/games';
import { describeRandomCombination, generateRandomCombination } from '@/domain/picks';
import type { GameRule, LotteryDraw } from '@/domain/types';
import { formatDrawDate, formatDrawTime } from '@/lib/format';
import { useDraws } from '@/providers/draws-provider';
import { useAppTheme } from '@/providers/preferences-provider';
import { palette, radius, spacing } from '@/theme/tokens';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function NumberChip({
  value,
  rule,
  tone = 'normal',
}: {
  value: number;
  rule: GameRule;
  tone?: 'hot' | 'cold' | 'normal';
}) {
  const { colors } = useAppTheme();
  const backgroundColor = tone === 'hot'
    ? colors.danger
    : tone === 'cold'
      ? palette.blue600
      : colors.primary;

  return (
    <View style={[styles.numberChip, { backgroundColor }]}>
      <Text style={styles.numberChipText}>{formatNumber(value, rule)}</Text>
    </View>
  );
}

function NumberChipList({
  values,
  rule,
  tone,
}: {
  values: readonly number[];
  rule: GameRule;
  tone: 'hot' | 'cold' | 'normal';
}) {
  const { colors } = useAppTheme();
  return values.length ? (
    <View style={styles.chipList}>
      {values.map((value) => <NumberChip key={value} rule={rule} tone={tone} value={value} />)}
    </View>
  ) : (
    <Text style={[styles.helper, { color: colors.textMuted }]}>All numbers are tied.</Text>
  );
}

interface NumberMetricItem {
  readonly key: string;
  readonly number: string;
  readonly primary: string;
  readonly secondary?: string;
  readonly band: FrequencyBand;
  readonly accessibilityLabel: string;
}

function useFrequencyBandColors() {
  const { colors, isDark } = useAppTheme();
  return useMemo<
    Readonly<Record<FrequencyBand, { readonly backgroundColor: string; readonly borderColor: string }>>
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
        borderColor: colors.border,
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
}

function HeatLegend() {
  const { colors } = useAppTheme();
  const bandColors = useFrequencyBandColors();
  return (
    <View style={styles.legendRow}>
      {FREQUENCY_BANDS.map((band) => (
        <View key={band} style={styles.legendItem}>
          <View style={[styles.legendDot, bandColors[band]]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>{band}</Text>
        </View>
      ))}
    </View>
  );
}

function NumberMetricGrid({
  items,
  showLegend = false,
}: {
  items: readonly NumberMetricItem[];
  showLegend?: boolean;
}) {
  const { colors } = useAppTheme();
  const bandColors = useFrequencyBandColors();
  return (
    <>
      <View style={styles.metricGrid}>
        {items.map((item) => (
          <View
            accessible
            accessibilityLabel={item.accessibilityLabel}
            key={item.key}
            style={[styles.metricCell, bandColors[item.band]]}>
            <Text style={[styles.metricNumber, { color: colors.text }]}>{item.number}</Text>
            <Text style={[styles.metricPrimary, { color: colors.text }]}>{item.primary}</Text>
            {item.secondary ? (
              <Text numberOfLines={1} style={[styles.metricSecondary, { color: colors.textMuted }]}>
                {item.secondary}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
      {showLegend ? <HeatLegend /> : null}
    </>
  );
}

function SummaryFinding({ analysis }: { analysis: GameAnalysis }) {
  const { colors } = useAppTheme();
  const commonParity = [...analysis.parityDistribution].sort(
    (left, right) => right.drawCount - left.drawCount || left.evenCount - right.evenCount,
  )[0];

  return (
    <>
      <SectionCard title="At a glance">
        <View style={styles.statsGrid}>
          <StatCard label="Draws" value={String(analysis.summary.drawCount)} tone="teal" />
          <StatCard
            label="Common mix"
            value={commonParity ? `${commonParity.evenCount} even / ${commonParity.oddCount} odd` : 'N/A'}
          />
          <StatCard label="Average total" value={analysis.sumStatistics.average?.toFixed(1) ?? 'N/A'} />
          <StatCard
            label="Repeated from prior"
            value={analysis.previousOverlap.comparisons
              ? `${analysis.previousOverlap.drawsSharingAtLeastOne} of ${analysis.previousOverlap.comparisons}`
              : 'N/A'}
            tone="gold"
          />
        </View>
      </SectionCard>
      <SectionCard title="Most seen numbers">
        <NumberChipList rule={analysis.rule} tone="hot" values={analysis.hotNumbers} />
        <Text style={[styles.helper, { color: colors.textMuted }]}>These had the highest count in the latest {analysis.summary.drawCount} draws.</Text>
      </SectionCard>
      <SectionCard title="Least seen numbers">
        <NumberChipList rule={analysis.rule} tone="cold" values={analysis.coldNumbers} />
        <Text style={[styles.helper, { color: colors.textMuted }]}>These had the lowest count in the latest {analysis.summary.drawCount} draws.</Text>
      </SectionCard>
    </>
  );
}

function FrequencyFinding({ analysis }: { analysis: GameAnalysis }) {
  const { colors } = useAppTheme();
  const items = rankFrequencyRows(analysis.frequency).map(({ row, band }) => ({
    key: String(row.numericValue),
    number: row.number,
    primary: `${row.appearanceCount}x`,
    secondary: `${row.drawHitRatePct.toFixed(0)}%`,
    band,
    accessibilityLabel: `Number ${row.number}, ${row.appearanceCount} appearances in ${row.drawHitCount} of ${analysis.summary.drawCount} draws, ${band}.`,
  }));

  return (
    <SectionCard
      title="Every number"
      subtitle={`Most seen first. Counts use the latest ${analysis.summary.drawCount} draws.`}>
      <View style={[styles.tableHeader, { backgroundColor: colors.surfaceAlt }]}>
        <Text style={[styles.tableHeaderText, { color: colors.textMuted }]}>COUNTING ALL {analysis.summary.numberObservations} DRAWN VALUES</Text>
      </View>
      <NumberMetricGrid items={items} showLegend />
      <Text style={[styles.helper, { color: colors.textMuted }]}>Color is relative to this selected set; each tile also shows its exact count and draw rate.</Text>
    </SectionCard>
  );
}

function NumberChartFinding({ analysis }: { analysis: GameAnalysis }) {
  const { colors } = useAppTheme();
  const features = analysis.drawFeatures;

  return (
    <>
      <SectionCard title="Draw scatter" subtitle={`Every drawn value across ${features.length} draws. Newest is on the right.`}>
        <DrawScatterChart analysis={analysis} />
      </SectionCard>
      <SectionCard title="Draws shown">
        {features.map((feature) => (
          <View key={`${feature.gameCode}-${feature.date}-${feature.time}`} style={[styles.drawRow, { borderBottomColor: colors.border }]}>
            <View style={styles.drawCopy}>
              <Text style={[styles.drawDate, { color: colors.text }]}>{formatDrawDate(feature.date)}</Text>
              <Text style={[styles.drawTime, { color: colors.primary }]}>{formatDrawTime(feature.time)}</Text>
            </View>
            <NumberBalls numbers={[...feature.numbers]} rule={analysis.rule} />
          </View>
        ))}
      </SectionCard>
    </>
  );
}

function TrendFinding({ analysis }: { analysis: GameAnalysis }) {
  return (
    <SectionCard title="Older versus newer" subtitle="Two lines compare equally sized halves of the analyzed draws.">
      <FrequencyTrendChart analysis={analysis} />
    </SectionCard>
  );
}

function GapsFinding({ analysis }: { analysis: GameAnalysis }) {
  return (
    <SectionCard title="Last seen and gaps" subtitle="Every number is ordered from longest current gap to shortest.">
      <GapDetailsTable analysis={analysis} />
    </SectionCard>
  );
}

function ParityFinding({ analysis }: { analysis: GameAnalysis }) {
  const { colors } = useAppTheme();

  return (
    <>
      <SectionCard title="Overall values">
        <View style={styles.statsGrid}>
          <StatCard label="Even values" value={`${analysis.summary.evenOccurrences} · ${analysis.summary.evenOccurrencePct.toFixed(0)}%`} tone="teal" />
          <StatCard label="Odd values" value={`${analysis.summary.oddOccurrences} · ${analysis.summary.oddOccurrencePct.toFixed(0)}%`} tone="gold" />
        </View>
        <ParityDonutChart analysis={analysis} />
      </SectionCard>
      <SectionCard title="Mix per draw" subtitle={`Observed across ${analysis.summary.drawCount} draws; fair is the long-run mathematical share.`}>
        {analysis.parityDistribution.map((row) => (
          <View key={row.pattern} style={[styles.distributionRow, { borderBottomColor: colors.border }]}>
            <View style={styles.distributionHeading}>
              <Text style={[styles.distributionLabel, { color: colors.text }]}>{row.evenCount} even / {row.oddCount} odd</Text>
              <Text style={[styles.distributionDetail, { color: colors.textMuted }]}>{row.drawCount} draws · {row.observedPct.toFixed(0)}%</Text>
            </View>
            <View style={[styles.distributionTrack, { backgroundColor: colors.surfaceAlt }]}>
              <View style={[styles.distributionFill, { backgroundColor: colors.primary, width: `${row.observedPct}%` as `${number}%` }]} />
              <View style={[styles.fairMarker, { backgroundColor: colors.danger, left: `${row.theoreticalPct}%` as `${number}%` }]} />
            </View>
            <Text style={[styles.distributionFair, { color: colors.textMuted }]}>Red marker: {row.theoreticalPct.toFixed(0)}% fair share</Text>
          </View>
        ))}
      </SectionCard>
    </>
  );
}

function PatternTags({
  rows,
  empty,
}: {
  rows: readonly {
    key: string;
    occurrenceCount: number;
    drawSupportCount: number;
    drawSupportPct: number;
  }[];
  empty: string;
}) {
  const { colors } = useAppTheme();
  return rows.length ? (
    <View style={styles.patternList}>
      {rows.map((row) => (
        <View key={row.key} style={[styles.patternTag, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.patternKey, { color: colors.text }]}>{row.key}</Text>
          <Text style={[styles.patternCount, { color: colors.textMuted }]}>
            {row.occurrenceCount}x · {row.drawSupportCount} draw{row.drawSupportCount === 1 ? '' : 's'} · {row.drawSupportPct.toFixed(0)}%
          </Text>
        </View>
      ))}
    </View>
  ) : (
    <Text style={[styles.helper, { color: colors.textMuted }]}>{empty}</Text>
  );
}

function PatternsFinding({ analysis }: { analysis: GameAnalysis }) {
  return (
    <>
      <SectionCard title="Totals and repeats">
        <View style={styles.statsGrid}>
          <StatCard label="Average total" value={analysis.sumStatistics.average?.toFixed(1) ?? 'N/A'} />
          <StatCard label="Total range" value={`${analysis.sumStatistics.minimum ?? '-'}-${analysis.sumStatistics.maximum ?? '-'}`} />
          <StatCard label="With consecutive" value={`${analysis.consecutive.drawsWithConsecutive} of ${analysis.summary.drawCount}`} tone="gold" />
          <StatCard label="Repeated from prior" value={`${analysis.previousOverlap.drawsSharingAtLeastOne} of ${analysis.previousOverlap.comparisons}`} tone="teal" />
        </View>
      </SectionCard>
      <SectionCard title="Low and high mix" subtitle={`Low ${analysis.rule.minimum}-${analysis.summary.lowBoundary}; high ${analysis.summary.highBoundary}-${analysis.rule.maximum}.`}>
        <LowHighDistributionChart analysis={analysis} />
      </SectionCard>
      <SectionCard title={analysis.rule.ordered ? 'Common adjacent steps' : 'Common pairs'}>
        <PatternTags empty="No pairs were available." rows={analysis.pairFrequency.slice(0, 20)} />
      </SectionCard>
      <SectionCard title="Common triples">
        <PatternTags empty="Triple analysis does not apply or no triples were available." rows={analysis.tripleFrequency.slice(0, 20)} />
      </SectionCard>
      <SectionCard title="Totals over time" subtitle="The area line connects each draw total in date order.">
        <DrawTotalsAreaChart analysis={analysis} />
      </SectionCard>
    </>
  );
}

function PositionFinding({ analysis }: { analysis: GameAnalysis }) {
  return (
    <SectionCard title="Position comparison" subtitle="Each colored line represents one exact position in the draw.">
      <PositionFrequencyChart analysis={analysis} />
    </SectionCard>
  );
}

function RandomFinding({
  analysis,
  draws,
}: {
  analysis: GameAnalysis;
  draws: readonly LotteryDraw[];
}) {
  const { colors } = useAppTheme();
  const { runBeforeGeneration } = useGenerationInterstitial('analysis');
  const { rule } = analysis;
  const [numbers, setNumbers] = useState(() => generateRandomCombination(rule));
  const [commentary, setCommentary] = useState(() =>
    describeRandomCombination(numbers, rule, draws, null),
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationInFlight = useRef(false);
  const generationRequest = useRef(0);

  useEffect(
    () => () => {
      generationRequest.current += 1;
      generationInFlight.current = false;
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const generate = () => {
    if (generationInFlight.current) return;
    generationInFlight.current = true;
    const request = generationRequest.current + 1;
    generationRequest.current = request;
    setIsGenerating(true);
    runBeforeGeneration(() => {
      if (request !== generationRequest.current) return;
      timer.current = setTimeout(() => {
        if (request !== generationRequest.current) return;
        const next = generateRandomCombination(rule);
        setNumbers(next);
        setCommentary((current) =>
          describeRandomCombination(next, rule, draws, current),
        );
        generationInFlight.current = false;
        setIsGenerating(false);
        timer.current = null;
      }, 650);
    });
  };

  return (
    <>
      <SectionCard title="Random combination">
        <View style={isGenerating ? styles.generatingCombination : undefined}>
          <NumberBalls numbers={numbers} rule={rule} />
        </View>
        <View style={[styles.randomComment, { backgroundColor: colors.surfaceAlt }]}>
          {isGenerating ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Ionicons color={colors.primary} name="sparkles-outline" size={18} />
          )}
          <Text style={[styles.randomCommentText, { color: colors.text }]}>
            {isGenerating ? 'Generating best possible combination...' : commentary}
          </Text>
        </View>
        <ActionButton
          disabled={isGenerating}
          icon="shuffle"
          label={isGenerating ? 'Generating...' : 'New combination'}
          onPress={generate}
        />
      </SectionCard>
    </>
  );
}

function FindingContent({
  finding,
  analysis,
  draws,
}: {
  finding: AnalysisFinding;
  analysis: GameAnalysis;
  draws: readonly LotteryDraw[];
}) {
  switch (finding) {
    case 'summary': return <SummaryFinding analysis={analysis} />;
    case 'frequency': return <FrequencyFinding analysis={analysis} />;
    case 'chart': return <NumberChartFinding analysis={analysis} />;
    case 'trend': return <TrendFinding analysis={analysis} />;
    case 'gaps': return <GapsFinding analysis={analysis} />;
    case 'parity': return <ParityFinding analysis={analysis} />;
    case 'patterns': return <PatternsFinding analysis={analysis} />;
    case 'position': return analysis.rule.ordered
      ? <PositionFinding analysis={analysis} />
      : <Notice>This finding only applies to exact-order games.</Notice>;
    case 'random': return <RandomFinding analysis={analysis} draws={draws} />;
  }
}

export default function AnalysisFindingScreen() {
  const params = useLocalSearchParams<{
    finding?: string | string[];
    game?: string | string[];
    slot?: string | string[];
  }>();
  const { draws } = useDraws();
  const { colors } = useAppTheme();
  const rawGame = firstParam(params.game);
  const rawFinding = firstParam(params.finding);
  const gameCode = isLogicalGameCode(rawGame) ? rawGame : null;
  const rule = gameCode ? GAME_BY_CODE[gameCode] : null;
  const requestedSlot = firstParam(params.slot) ?? 'ALL';
  const slot = gameCode && rule && isAnalysisSlotForGame(requestedSlot, gameCode, rule)
    ? requestedSlot
    : 'ALL';
  const finding = isAnalysisFinding(rawFinding) ? rawFinding : null;
  const findingMeta = finding ? ANALYSIS_FINDINGS.find((item) => item.id === finding) : null;
  const selectedDraws = useMemo(
    () => gameCode ? latestAnalysisDraws(draws, gameCode, slot) : [],
    [draws, gameCode, slot],
  );
  const analysis = useMemo(
    () => rule && selectedDraws.length
      ? analyzeGame(selectedDraws, rule, { candidatePoolSize: 250 })
      : null,
    [rule, selectedDraws],
  );
  const timeLabel = rule?.slots?.find((item) => item.gameCode === slot)?.label ?? 'All times';

  return (
    <Screen
      backLabel="Back to analysis"
      onBack={() => router.back()}
      title={findingMeta?.title ?? 'Analysis finding'}>
      {!rule || !finding || !analysis ? (
        <Notice tone="warning">This analysis finding is unavailable.</Notice>
      ) : (
        <>
          <View style={[styles.scopeCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Text style={[styles.scopeTitle, { color: colors.text }]}>{rule.name} · {timeLabel}</Text>
            <Text style={[styles.scopeText, { color: colors.textMuted }]}>
              Latest {analysis.summary.drawCount} draws · {formatDrawDate(analysis.summary.selectedStartDate ?? '')} to {formatDrawDate(analysis.summary.selectedEndDate ?? '')}
            </Text>
          </View>
          <FindingContent analysis={analysis} draws={selectedDraws} finding={finding} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scopeCard: { padding: spacing.md, gap: 2, borderWidth: 1, borderRadius: radius.md },
  scopeTitle: { fontSize: 14, lineHeight: 18, fontWeight: '900' },
  scopeText: { fontSize: 10, lineHeight: 14, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chipList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  numberChip: { minWidth: 32, height: 32, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  numberChipText: { color: palette.white, fontSize: 11, fontWeight: '900' },
  helper: { fontSize: 10, lineHeight: 15 },
  tableHeader: { paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: radius.sm },
  tableHeaderText: { fontSize: 8, lineHeight: 11, fontWeight: '900', letterSpacing: 0.7 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metricCell: {
    width: 48,
    minHeight: 58,
    paddingHorizontal: 4,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  metricNumber: { fontSize: 14, lineHeight: 17, fontWeight: '900' },
  metricPrimary: { marginTop: 2, fontSize: 9, lineHeight: 12, fontWeight: '900', textAlign: 'center' },
  metricSecondary: { marginTop: 1, fontSize: 8, lineHeight: 10, fontWeight: '700', textAlign: 'center' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 12, height: 12, borderWidth: 1, borderRadius: 3 },
  legendText: { fontSize: 9, lineHeight: 12, fontWeight: '700', textTransform: 'capitalize' },
  distributionRow: { paddingVertical: spacing.sm, gap: 5, borderBottomWidth: StyleSheet.hairlineWidth },
  distributionHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  distributionLabel: { flex: 1, fontSize: 10, lineHeight: 14, fontWeight: '900' },
  distributionDetail: { flexShrink: 1, fontSize: 8, lineHeight: 12, fontWeight: '700', textAlign: 'right' },
  distributionTrack: { height: 9, position: 'relative', overflow: 'hidden', borderRadius: radius.pill },
  distributionFill: { height: '100%', borderRadius: radius.pill },
  fairMarker: { width: 2, position: 'absolute', top: 0, bottom: 0 },
  distributionFair: { fontSize: 8, lineHeight: 11, textAlign: 'right' },
  drawRow: { paddingVertical: spacing.sm, gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  drawCopy: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  drawDate: { fontSize: 10, fontWeight: '900' },
  drawTime: { fontSize: 10, fontWeight: '900' },
  patternList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  patternTag: { minHeight: 42, paddingHorizontal: spacing.sm, paddingVertical: 6, flexBasis: 110, flexGrow: 1, justifyContent: 'center', borderRadius: radius.sm },
  patternKey: { fontSize: 10, fontWeight: '900' },
  patternCount: { marginTop: 1, fontSize: 8, fontWeight: '700' },
  generatingCombination: { opacity: 0.42 },
  randomComment: {
    minHeight: 58,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
  },
  randomCommentText: { flex: 1, fontSize: 11, lineHeight: 17, fontWeight: '700' },
});
