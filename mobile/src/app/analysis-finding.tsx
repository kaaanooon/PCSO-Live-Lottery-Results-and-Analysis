import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { Notice } from '@/components/notice';
import { NumberBalls } from '@/components/number-balls';
import { Screen } from '@/components/screen';
import { SectionCard } from '@/components/section-card';
import { StatCard } from '@/components/stat-card';
import { analyzeGame, type FrequencyRow, type GameAnalysis } from '@/domain/analysis';
import {
  ANALYSIS_FINDINGS,
  isAnalysisFinding,
  isAnalysisSlotForGame,
  latestAnalysisDraws,
  type AnalysisFinding,
} from '@/domain/analysis-navigation';
import { GAME_BY_CODE, formatNumber, isLogicalGameCode, theoreticalOutcomeCount } from '@/domain/games';
import { generateRandomCombination } from '@/domain/picks';
import type { GameRule } from '@/domain/types';
import { formatCount, formatDrawDate, formatDrawTime } from '@/lib/format';
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
        <Text style={[styles.helper, { color: colors.textMuted }]}>These had the highest count in these 10 draws.</Text>
      </SectionCard>
      <SectionCard title="Least seen numbers">
        <NumberChipList rule={analysis.rule} tone="cold" values={analysis.coldNumbers} />
        <Text style={[styles.helper, { color: colors.textMuted }]}>A low count does not make a number due.</Text>
      </SectionCard>
    </>
  );
}

function FrequencyBar({
  row,
  maximum,
  drawCount,
}: {
  row: FrequencyRow;
  maximum: number;
  drawCount: number;
}) {
  const { colors } = useAppTheme();
  const tone = row.temperature === 'Sample hot'
    ? colors.danger
    : row.temperature === 'Sample cold'
      ? palette.blue600
      : colors.primary;
  const status = row.temperature.replace('Sample ', '');

  return (
    <View
      accessible
      accessibilityLabel={`Number ${row.number}: ${row.appearanceCount} appearances in ${row.drawHitCount} draws.`}
      style={[styles.frequencyRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.frequencyNumber, { backgroundColor: tone }]}>
        <Text style={styles.frequencyNumberText}>{row.number}</Text>
      </View>
      <View style={styles.frequencyBody}>
        <View style={styles.frequencyHeading}>
          <Text style={[styles.frequencyCount, { color: colors.text }]}>{row.appearanceCount} time{row.appearanceCount === 1 ? '' : 's'}</Text>
          <Text style={[styles.frequencyStatus, { color: tone }]}>{status}</Text>
        </View>
        <View style={[styles.barTrack, { backgroundColor: colors.surfaceAlt }]}>
          <View
            style={[
              styles.barFill,
              {
                backgroundColor: tone,
                width: `${row.appearanceCount === 0 ? 0 : Math.max(5, (row.appearanceCount / maximum) * 100)}%` as `${number}%`,
              },
            ]}
          />
        </View>
        <Text style={[styles.frequencyMeta, { color: colors.textMuted }]}>
          In {row.drawHitCount} of {drawCount} draws · {row.drawHitRatePct.toFixed(0)}% draw rate · expected {row.expectedCount.toFixed(1)}
        </Text>
      </View>
    </View>
  );
}

function FrequencyFinding({ analysis }: { analysis: GameAnalysis }) {
  const { colors } = useAppTheme();
  const rows = [...analysis.frequency].sort(
    (left, right) => right.appearanceCount - left.appearanceCount || left.numericValue - right.numericValue,
  );
  const maximum = Math.max(1, ...rows.map((row) => row.appearanceCount));

  return (
    <SectionCard title="Every number" subtitle="Ranked from most to least appearances.">
      <View style={[styles.tableHeader, { backgroundColor: colors.surfaceAlt }]}>
        <Text style={[styles.tableHeaderText, { color: colors.textMuted }]}>COUNTING ALL {analysis.summary.numberObservations} DRAWN VALUES</Text>
      </View>
      {rows.map((row) => (
        <FrequencyBar
          drawCount={analysis.summary.drawCount}
          key={row.numericValue}
          maximum={maximum}
          row={row}
        />
      ))}
    </SectionCard>
  );
}

function NumberChartFinding({ analysis }: { analysis: GameAnalysis }) {
  const { colors, isDark } = useAppTheme();
  const features = analysis.drawFeatures;
  const { minimum, maximum } = analysis.rule;
  const valueSpan = Math.max(1, maximum - minimum);

  return (
    <>
      <SectionCard title="Number chart" subtitle="Each dot is one drawn value. Newest draws are on the right.">
        <View
          accessible
          accessibilityLabel={`Number chart for ${features.length} draws from ${minimum} through ${maximum}.`}
          accessibilityRole="image"
          style={styles.scatterFigure}>
          <View style={styles.scatterRow}>
            <View style={styles.scatterLabels}>
              <Text style={[styles.axisLabel, { color: colors.textMuted }]}>{maximum}</Text>
              <Text style={[styles.axisLabel, { color: colors.textMuted }]}>{Math.round((minimum + maximum) / 2)}</Text>
              <Text style={[styles.axisLabel, { color: colors.textMuted }]}>{minimum}</Text>
            </View>
            <View style={[styles.scatterPlot, { backgroundColor: colors.input, borderColor: colors.border }]}>
              {[0, 50, 100].map((position) => (
                <View
                  key={position}
                  style={[styles.gridLine, { backgroundColor: colors.border, bottom: `${position}%` as `${number}%` }]}
                />
              ))}
              {features.flatMap((feature, drawIndex) =>
                feature.numbers.map((number, numberIndex) => {
                  const baseLeft = features.length === 1 ? 50 : 3 + (drawIndex / (features.length - 1)) * 94;
                  const offset = (numberIndex - (feature.numbers.length - 1) / 2) * 0.55;
                  const left = Math.max(1, Math.min(97, baseLeft + offset));
                  const bottom = 2 + ((number - minimum) / valueSpan) * 96;
                  return (
                    <View
                      key={`${feature.index}-${numberIndex}-${number}`}
                      style={[
                        styles.scatterDot,
                        analysis.rule.ordered && styles.orderedDot,
                        {
                          backgroundColor: analysis.rule.ordered
                            ? isDark ? colors.danger : palette.coral600
                            : colors.primary,
                          bottom: `${bottom}%` as `${number}%`,
                          left: `${left}%` as `${number}%`,
                        },
                      ]}
                    />
                  );
                }),
              )}
            </View>
          </View>
          <View style={styles.axisDates}>
            <Text style={[styles.axisLabel, { color: colors.textMuted }]}>{formatDrawDate(features[0]?.date ?? '')}</Text>
            <Text style={[styles.axisLabel, { color: colors.textMuted }]}>{formatDrawDate(features.at(-1)?.date ?? '')}</Text>
          </View>
        </View>
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
  const { colors } = useAppTheme();
  const split = Math.max(1, Math.floor(analysis.drawFeatures.length / 2));
  const older = analysis.drawFeatures.slice(0, split);
  const recent = analysis.drawFeatures.slice(split);
  const count = (features: typeof analysis.drawFeatures, number: number) =>
    features.reduce(
      (total, feature) => total + feature.numbers.filter((value) => value === number).length,
      0,
    );
  const rows = analysis.frequency
    .map((row) => {
      const olderCount = count(older, row.numericValue);
      const recentCount = count(recent, row.numericValue);
      return { row, olderCount, recentCount, difference: recentCount - olderCount };
    })
    .sort((left, right) => right.difference - left.difference || left.row.numericValue - right.row.numericValue);

  return (
    <SectionCard title="Every number" subtitle={`${older.length} older draws compared with ${recent.length} newer draws.`}>
      {rows.map(({ row, olderCount, recentCount, difference }) => {
        const color = difference > 0 ? colors.danger : difference < 0 ? palette.blue600 : colors.textMuted;
        const icon = difference > 0 ? 'arrow-up' : difference < 0 ? 'arrow-down' : 'remove';
        return (
          <View key={row.numericValue} style={[styles.trendRow, { borderBottomColor: colors.border }]}>
            <NumberChip rule={analysis.rule} tone="normal" value={row.numericValue} />
            <View style={styles.trendCounts}>
              <Text style={[styles.trendMain, { color: colors.text }]}>{olderCount} before → {recentCount} recent</Text>
              <Text style={[styles.trendMeta, { color: colors.textMuted }]}>All 10 draws: {row.appearanceCount}</Text>
            </View>
            <View style={[styles.trendBadge, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons color={color} name={icon} size={16} />
              <Text style={[styles.trendDifference, { color }]}>{difference > 0 ? `+${difference}` : difference}</Text>
            </View>
          </View>
        );
      })}
    </SectionCard>
  );
}

function GapsFinding({ analysis }: { analysis: GameAnalysis }) {
  const { colors } = useAppTheme();
  const rows = [...analysis.frequency].sort((left, right) => left.numericValue - right.numericValue);

  return (
    <SectionCard title="Every number" subtitle="Since means draws since its latest appearance, not days.">
      <View style={[styles.gapRow, styles.gapHeader, { backgroundColor: colors.surfaceAlt }]}>
        <Text style={[styles.gapNumber, styles.headerText, { color: colors.text }]}>No.</Text>
        <Text style={[styles.gapMetric, styles.headerText, { color: colors.text }]}>Since</Text>
        <Text style={[styles.gapMetric, styles.headerText, { color: colors.text }]}>Avg gap</Text>
        <Text style={[styles.gapDate, styles.headerText, { color: colors.text }]}>Last seen</Text>
      </View>
      {rows.map((row) => (
        <View key={row.numericValue} style={[styles.gapRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.gapNumber, styles.gapValue, { color: colors.text }]}>{row.number}</Text>
          <Text style={[styles.gapMetric, styles.gapValue, { color: colors.textMuted }]}>{row.drawsSinceLast ?? 'Not in 10'}</Text>
          <Text style={[styles.gapMetric, styles.gapValue, { color: colors.textMuted }]}>{row.meanGapDraws?.toFixed(1) ?? '-'}</Text>
          <Text style={[styles.gapDate, styles.gapValue, { color: colors.textMuted }]}>{row.lastSeen ? formatDrawDate(row.lastSeen) : '-'}</Text>
        </View>
      ))}
    </SectionCard>
  );
}

function ParityFinding({ analysis }: { analysis: GameAnalysis }) {
  const { colors } = useAppTheme();
  const maximum = Math.max(1, ...analysis.parityDistribution.map((row) => row.observedPct));

  return (
    <>
      <SectionCard title="Overall values">
        <View style={styles.statsGrid}>
          <StatCard label="Even values" value={`${analysis.summary.evenOccurrences} · ${analysis.summary.evenOccurrencePct.toFixed(0)}%`} tone="teal" />
          <StatCard label="Odd values" value={`${analysis.summary.oddOccurrences} · ${analysis.summary.oddOccurrencePct.toFixed(0)}%`} tone="gold" />
        </View>
      </SectionCard>
      <SectionCard title="Mix per draw" subtitle="Observed is what happened in these 10 draws; fair is the long-run mathematical share.">
        {analysis.parityDistribution.map((row) => (
          <View key={row.pattern} style={[styles.parityRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.parityPattern, { color: colors.text }]}>{row.evenCount} even / {row.oddCount} odd</Text>
            <View style={styles.parityBody}>
              <View style={[styles.barTrack, { backgroundColor: colors.surfaceAlt }]}>
                <View style={[styles.barFill, { backgroundColor: colors.primary, width: `${(row.observedPct / maximum) * 100}%` as `${number}%` }]} />
              </View>
              <Text style={[styles.frequencyMeta, { color: colors.textMuted }]}>{row.drawCount} draws · observed {row.observedPct.toFixed(0)}% · fair {row.theoreticalPct.toFixed(0)}%</Text>
            </View>
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
  rows: readonly { key: string; drawSupportCount: number }[];
  empty: string;
}) {
  const { colors } = useAppTheme();
  return rows.length ? (
    <View style={styles.patternList}>
      {rows.map((row) => (
        <View key={row.key} style={[styles.patternTag, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.patternKey, { color: colors.text }]}>{row.key}</Text>
          <Text style={[styles.patternCount, { color: colors.textMuted }]}>{row.drawSupportCount} draw{row.drawSupportCount === 1 ? '' : 's'}</Text>
        </View>
      ))}
    </View>
  ) : (
    <Text style={[styles.helper, { color: colors.textMuted }]}>{empty}</Text>
  );
}

function PatternsFinding({ analysis }: { analysis: GameAnalysis }) {
  const { colors } = useAppTheme();

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
        {analysis.lowHighDistribution.map((row) => (
          <View key={row.pattern} style={[styles.simpleRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.simpleTitle, { color: colors.text }]}>{row.lowCount} low / {row.highCount} high</Text>
            <Text style={[styles.simpleValue, { color: colors.textMuted }]}>{row.drawCount} draws · {row.observedPct.toFixed(0)}%</Text>
          </View>
        ))}
      </SectionCard>
      <SectionCard title={analysis.rule.ordered ? 'Common adjacent steps' : 'Common pairs'}>
        <PatternTags empty="No pairs were available." rows={analysis.pairFrequency.slice(0, 20)} />
      </SectionCard>
      <SectionCard title="Common triples">
        <PatternTags empty="Triple analysis does not apply or no triples were available." rows={analysis.tripleFrequency.slice(0, 20)} />
      </SectionCard>
      <SectionCard title="Total for each draw">
        {analysis.drawFeatures.map((feature) => (
          <View key={`${feature.gameCode}-${feature.date}-${feature.time}`} style={[styles.simpleRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.simpleTitle, { color: colors.text }]}>{formatDrawDate(feature.date)} · {formatDrawTime(feature.time)}</Text>
            <Text style={[styles.simpleValue, { color: colors.primary }]}>Total {feature.sum}</Text>
          </View>
        ))}
      </SectionCard>
    </>
  );
}

function PositionFinding({ analysis }: { analysis: GameAnalysis }) {
  const { colors } = useAppTheme();

  return (
    <>
      {Array.from({ length: analysis.rule.pickCount }, (_, index) => {
        const position = index + 1;
        const rows = analysis.positionFrequency.filter((row) => row.position === position);
        const maximum = Math.max(1, ...rows.map((row) => row.count));
        return (
          <SectionCard key={position} title={`Position ${position}`} subtitle="Every possible value is shown.">
            {rows.map((row) => (
              <View key={`${position}-${row.numericValue}`} style={[styles.positionRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.positionNumber, { color: colors.text }]}>{row.number}</Text>
                <View style={styles.positionBody}>
                  <View style={[styles.barTrack, { backgroundColor: colors.surfaceAlt }]}>
                    <View style={[styles.barFill, { backgroundColor: colors.primary, width: `${row.count ? Math.max(5, (row.count / maximum) * 100) : 0}%` as `${number}%` }]} />
                  </View>
                </View>
                <Text style={[styles.positionCount, { color: colors.textMuted }]}>{row.count} · {row.ratePct.toFixed(0)}%</Text>
              </View>
            ))}
          </SectionCard>
        );
      })}
    </>
  );
}

function describeRandomCombination(
  numbers: readonly number[],
  analysis: GameAnalysis,
  previous: string | null,
): string {
  const drawCount = analysis.summary.drawCount;
  const evenCount = numbers.filter((number) => number % 2 === 0).length;
  const lowCount = numbers.filter(
    (number) => number <= analysis.summary.lowBoundary,
  ).length;
  const sum = numbers.reduce((total, number) => total + number, 0);
  const orderedForPairs = analysis.rule.ordered
    ? numbers
    : [...numbers].sort((left, right) => left - right);
  const consecutivePairs = orderedForPairs
    .slice(1)
    .filter((number, index) => Math.abs(number - orderedForPairs[index]!) === 1)
    .length;
  const hotCount = numbers.filter((number) =>
    analysis.hotNumbers.includes(number),
  ).length;
  const coldCount = numbers.filter((number) =>
    analysis.coldNumbers.includes(number),
  ).length;
  const comments = [
    'Pattern: ' + evenCount + ' even and ' + (numbers.length - evenCount) +
      ' odd. This mix does not change the pick\'s odds.',
    'Range: ' + lowCount + ' low and ' + (numbers.length - lowCount) +
      ' high, using ' + analysis.summary.lowBoundary + ' as the low-number limit.',
    consecutivePairs
      ? 'This pick has ' + consecutivePairs + ' consecutive pair' +
        (consecutivePairs === 1 ? '' : 's') + '. That is only a pattern description.'
      : 'This pick has no consecutive pair. That does not make it better or worse.',
  ];

  if (analysis.sumStatistics.average !== null) {
    const relation = sum > analysis.sumStatistics.average
      ? 'above'
      : sum < analysis.sumStatistics.average
        ? 'below'
        : 'equal to';
    comments.push(
      'Its total is ' + sum + ', ' + relation + ' the ' +
        analysis.sumStatistics.average.toFixed(1) + ' average in these latest ' +
        drawCount + ' draws.',
    );
  }

  if (analysis.hotNumbers.length) {
    comments.push(
      hotCount
        ? 'It includes ' + hotCount + ' of the most-seen numbers in the latest ' +
          drawCount + ' draws. They are not more likely next time.'
        : 'It includes none of the most-seen numbers in the latest ' + drawCount +
          ' draws. Its odds are still unchanged.',
    );
  }

  if (analysis.coldNumbers.length) {
    comments.push(
      coldCount
        ? 'It includes ' + coldCount + ' of the least-seen numbers in the latest ' +
          drawCount + ' draws. A cold number is not due.'
        : 'It includes none of the least-seen numbers in the latest ' + drawCount +
          ' draws. That has no effect on its odds.',
    );
  }

  if (analysis.rule.ordered) {
    const distinct = new Set(numbers).size;
    comments.push(
      distinct === numbers.length
        ? 'Every digit position is different in this random pick.'
        : 'This random pick repeats ' + (numbers.length - distinct) +
          ' digit position' + (numbers.length - distinct === 1 ? '' : 's') + '.',
    );
  }

  const alternatives = comments.filter((comment) => comment !== previous);
  return alternatives[Math.floor(Math.random() * alternatives.length)] ?? comments[0]!;
}

function RandomFinding({ analysis }: { analysis: GameAnalysis }) {
  const { colors } = useAppTheme();
  const { rule } = analysis;
  const [numbers, setNumbers] = useState(() => generateRandomCombination(rule));
  const [commentary, setCommentary] = useState(() =>
    describeRandomCombination(numbers, analysis, null),
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const generate = () => {
    if (isGenerating) return;
    setIsGenerating(true);
    timer.current = setTimeout(() => {
      const next = generateRandomCombination(rule);
      setNumbers(next);
      setCommentary((current) =>
        describeRandomCombination(next, analysis, current),
      );
      setIsGenerating(false);
      timer.current = null;
    }, 650);
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
            {isGenerating ? 'Creating and describing a new random pick...' : commentary}
          </Text>
        </View>
        <ActionButton
          disabled={isGenerating}
          icon="shuffle"
          label={isGenerating ? 'Generating...' : 'New combination'}
          onPress={generate}
        />
      </SectionCard>
      <Notice>
        The numbers are completely random. The sentence only describes how the
        pick compares with the latest draws; it does not predict the next draw.
      </Notice>
      <Text style={[styles.odds, { color: colors.textMuted }]}>Odds: 1 in {formatCount(theoreticalOutcomeCount(rule))}</Text>
    </>
  );
}

function FindingContent({ finding, analysis }: { finding: AnalysisFinding; analysis: GameAnalysis }) {
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
    case 'random': return <RandomFinding analysis={analysis} />;
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
          <FindingContent analysis={analysis} finding={finding} />
          {finding !== 'random' ? (
            <Notice tone="warning">Past results describe history only. They do not make any number more likely next time.</Notice>
          ) : null}
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
  frequencyRow: { paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  frequencyNumber: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  frequencyNumberText: { color: palette.white, fontSize: 11, fontWeight: '900' },
  frequencyBody: { flex: 1, minWidth: 0, gap: 5 },
  frequencyHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  frequencyCount: { fontSize: 11, fontWeight: '900' },
  frequencyStatus: { fontSize: 9, fontWeight: '900' },
  frequencyMeta: { fontSize: 9, lineHeight: 13 },
  barTrack: { height: 7, flex: 1, overflow: 'hidden', borderRadius: radius.pill },
  barFill: { height: '100%', borderRadius: radius.pill },
  scatterFigure: { gap: spacing.xs },
  scatterRow: { height: 240, flexDirection: 'row', gap: 6 },
  scatterLabels: { width: 28, justifyContent: 'space-between', alignItems: 'flex-end' },
  scatterPlot: { flex: 1, position: 'relative', overflow: 'hidden', borderWidth: 1, borderRadius: radius.md },
  gridLine: { position: 'absolute', right: 0, left: 0, height: StyleSheet.hairlineWidth },
  scatterDot: { position: 'absolute', width: 8, height: 8, marginLeft: -4, marginBottom: -4, borderRadius: 4 },
  orderedDot: { borderRadius: 2 },
  axisLabel: { fontSize: 8, lineHeight: 11, fontWeight: '700' },
  axisDates: { marginLeft: 34, flexDirection: 'row', justifyContent: 'space-between' },
  drawRow: { paddingVertical: spacing.sm, gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  drawCopy: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  drawDate: { fontSize: 10, fontWeight: '900' },
  drawTime: { fontSize: 10, fontWeight: '900' },
  trendRow: { paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  trendCounts: { flex: 1, minWidth: 0 },
  trendMain: { fontSize: 11, fontWeight: '900' },
  trendMeta: { marginTop: 2, fontSize: 9 },
  trendBadge: { minWidth: 50, height: 30, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: radius.pill },
  trendDifference: { fontSize: 10, fontWeight: '900' },
  gapRow: { minHeight: 42, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  gapHeader: { minHeight: 36, paddingHorizontal: 4, borderBottomWidth: 0, borderRadius: radius.sm },
  gapNumber: { width: 42 },
  gapMetric: { width: 64, textAlign: 'center' },
  gapDate: { flex: 1, textAlign: 'right' },
  headerText: { fontSize: 9, fontWeight: '900' },
  gapValue: { fontSize: 9, fontWeight: '700' },
  parityRow: { paddingVertical: spacing.sm, gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  parityPattern: { fontSize: 11, fontWeight: '900' },
  parityBody: { gap: 5 },
  patternList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  patternTag: { minHeight: 42, paddingHorizontal: spacing.sm, paddingVertical: 6, justifyContent: 'center', borderRadius: radius.sm },
  patternKey: { fontSize: 10, fontWeight: '900' },
  patternCount: { marginTop: 1, fontSize: 8, fontWeight: '700' },
  simpleRow: { minHeight: 42, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  simpleTitle: { flex: 1, fontSize: 10, fontWeight: '900' },
  simpleValue: { fontSize: 9, fontWeight: '800', textAlign: 'right' },
  positionRow: { minHeight: 38, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  positionNumber: { width: 34, fontSize: 10, fontWeight: '900' },
  positionBody: { flex: 1 },
  positionCount: { width: 62, fontSize: 9, fontWeight: '800', textAlign: 'right' },
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
  odds: { paddingHorizontal: spacing.xs, fontSize: 10, lineHeight: 15, textAlign: 'center' },
});
