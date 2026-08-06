import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { useAnalysisInterstitial } from '@/components/ads/analysis-interstitial';
import { CollapsibleSectionCard } from '@/components/collapsible-section-card';
import { AppTextInput, Field } from '@/components/form-controls';
import { GamePicker } from '@/components/game-picker';
import { Notice } from '@/components/notice';
import { NumberBalls } from '@/components/number-balls';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { StatCard } from '@/components/stat-card';
import { analyzeGame, type FrequencyRow, type GameAnalysis } from '@/domain/analysis';
import { GAME_BY_CODE, formatNumber } from '@/domain/games';
import type { DrawGameCode, LogicalGameCode, LotteryDraw } from '@/domain/types';
import { useDraws } from '@/providers/draws-provider';
import { useAppTheme } from '@/providers/preferences-provider';
import { formatCount, formatDrawDate, isValidIsoDate } from '@/lib/format';
import { palette, radius, spacing } from '@/theme/tokens';

type AnalysisMode = 'latest' | 'date';
type SlotFilter = 'ALL' | DrawGameCode;
type CalendarTarget = 'from' | 'to';
type CalendarStep = 'year' | 'month' | 'day';

type AnalysisConfig = {
  gameCode: LogicalGameCode;
  mode: AnalysisMode;
  drawCount: number;
  fromDate: string;
  toDate: string;
  slot: SlotFilter;
};

function minusDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function parseMonth(month: string): { year: number; monthIndex: number } {
  const [year, monthNumber] = month.split('-').map(Number);
  return { year: year!, monthIndex: monthNumber! - 1 };
}

function formatMonth(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

function calendarDays(month: string): (string | null)[] {
  const { year, monthIndex } = parseMonth(month);
  const leading = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const dayCount = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= dayCount; day += 1) {
    cells.push(
      `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    );
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function DateFieldButton({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();

  return (
    <Field label={label}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} date, ${formatDrawDate(value)}. Open calendar.`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.dateButton,
          { backgroundColor: colors.input, borderColor: colors.border },
          pressed && styles.dateButtonPressed,
          pressed && { backgroundColor: colors.surfaceAlt },
        ]}>
        <Text style={[styles.dateButtonValue, { color: colors.text }]}>{formatDrawDate(value)}</Text>
        <Text style={[styles.dateButtonAction, { color: colors.primary }]}>Change</Text>
      </Pressable>
    </Field>
  );
}

function CalendarModal({
  title,
  value,
  month,
  archiveMinimumDate,
  archiveMaximumDate,
  minimumDate,
  maximumDate,
  onMonthChange,
  onSelect,
  onClose,
}: {
  title: string;
  value: string;
  month: string;
  archiveMinimumDate: string;
  archiveMaximumDate: string;
  minimumDate: string;
  maximumDate: string;
  onMonthChange: (month: string) => void;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const { colors, isDark } = useAppTheme();
  const [step, setStep] = useState<CalendarStep>('year');
  const { year, monthIndex } = parseMonth(month);
  const archiveStartYear = Number(archiveMinimumDate.slice(0, 4));
  const archiveEndYear = Number(archiveMaximumDate.slice(0, 4));
  const years = Array.from(
    { length: archiveEndYear - archiveStartYear + 1 },
    (_, index) => archiveStartYear + index,
  );
  const stepOrder: readonly CalendarStep[] = ['year', 'month', 'day'];
  const activeStepIndex = stepOrder.indexOf(step);

  const yearIsDisabled = (candidateYear: number): boolean =>
    `${candidateYear}-12-31` < minimumDate || `${candidateYear}-01-01` > maximumDate;

  const monthBounds = (candidateYear: number, candidateMonthIndex: number) => {
    const prefix = formatMonth(candidateYear, candidateMonthIndex);
    const lastDay = new Date(Date.UTC(candidateYear, candidateMonthIndex + 1, 0)).getUTCDate();
    return {
      start: `${prefix}-01`,
      end: `${prefix}-${String(lastDay).padStart(2, '0')}`,
    };
  };

  const monthIsDisabled = (candidateMonthIndex: number): boolean => {
    const bounds = monthBounds(year, candidateMonthIndex);
    return bounds.end < minimumDate || bounds.start > maximumDate;
  };

  const chooseYear = (candidateYear: number) => {
    if (yearIsDisabled(candidateYear)) return;
    const validMonths = MONTH_NAMES.map((_, index) => index).filter((index) => {
      const bounds = monthBounds(candidateYear, index);
      return bounds.end >= minimumDate && bounds.start <= maximumDate;
    });
    const nearestMonth = validMonths.reduce(
      (nearest, candidate) =>
        Math.abs(candidate - monthIndex) < Math.abs(nearest - monthIndex) ? candidate : nearest,
      validMonths[0]!,
    );
    onMonthChange(formatMonth(candidateYear, nearestMonth));
    setStep('month');
  };

  const chooseMonth = (candidateMonthIndex: number) => {
    if (monthIsDisabled(candidateMonthIndex)) return;
    onMonthChange(formatMonth(year, candidateMonthIndex));
    setStep('day');
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent
      visible>
      <View style={[styles.calendarBackdrop, { backgroundColor: colors.overlay }]}>
        <Pressable
          accessibilityLabel="Close calendar"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.calendarDismiss}
        />
        <View
          accessibilityViewIsModal
          style={[styles.calendarCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.calendarTitleRow}>
            <View style={styles.calendarTitleCopy}>
              <Text accessibilityRole="header" style={[styles.calendarTitle, { color: colors.text }]}>{title}</Text>
              <Text style={[styles.calendarRange, { color: colors.textMuted }]}>
                Available: {formatDrawDate(archiveMinimumDate)} - {formatDrawDate(archiveMaximumDate)}
              </Text>
              {minimumDate !== archiveMinimumDate || maximumDate !== archiveMaximumDate ? (
                <Text style={[styles.calendarRange, { color: colors.textMuted }]}>
                  Select: {formatDrawDate(minimumDate)} - {formatDrawDate(maximumDate)}
                </Text>
              ) : null}
            </View>
            <Pressable
              accessibilityLabel="Close calendar"
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [
                styles.calendarClose,
                { backgroundColor: colors.surfaceAlt },
                pressed && styles.calendarPressed,
              ]}>
              <Text style={[styles.calendarCloseText, { color: colors.text }]}>Close</Text>
            </Pressable>
          </View>

          <View style={styles.calendarSteps}>
            {(['Year', 'Month', 'Day'] as const).map((label, index) => (
              <View
                key={label}
                style={[
                  styles.calendarStep,
                  { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                  index === activeStepIndex && [styles.calendarStepActive, {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  }],
                  index < activeStepIndex && [styles.calendarStepComplete, {
                    backgroundColor: colors.input,
                    borderColor: colors.primary,
                  }],
                ]}>
                <Text style={[
                  styles.calendarStepText,
                  { color: colors.textMuted },
                  index < activeStepIndex && [styles.calendarStepTextComplete, { color: colors.text }],
                  index === activeStepIndex && [
                    styles.calendarStepTextActive,
                    { color: isDark ? colors.header : palette.white },
                  ],
                ]}>
                  {label}
                </Text>
              </View>
            ))}
          </View>

          {step === 'year' ? (
            <View style={styles.calendarChoiceSection}>
              <Text style={[styles.calendarPrompt, { color: colors.text }]}>Choose a year</Text>
              <View style={styles.calendarOptionGrid}>
                {years.map((candidateYear) => {
                  const disabled = yearIsDisabled(candidateYear);
                  const selected = candidateYear === year;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ disabled, selected }}
                      disabled={disabled}
                      key={candidateYear}
                      onPress={() => chooseYear(candidateYear)}
                      style={({ pressed }) => [
                        styles.calendarOption,
                        { backgroundColor: colors.input, borderColor: colors.border },
                        selected && [styles.calendarOptionSelected, {
                          backgroundColor: colors.primary,
                          borderColor: colors.primary,
                        }],
                        disabled && [
                          styles.calendarOptionDisabled,
                          isDark && { opacity: 0.5 },
                        ],
                        pressed && !disabled && styles.calendarPressed,
                      ]}>
                      <Text style={[
                        styles.calendarOptionText,
                        { color: colors.text },
                        selected && [
                          styles.calendarOptionSelectedText,
                          { color: isDark ? colors.header : palette.white },
                        ],
                        disabled && [styles.calendarDisabledDayText, { color: colors.textMuted }],
                      ]}>
                        {candidateYear}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {step === 'month' ? (
            <View style={styles.calendarChoiceSection}>
              <View style={styles.calendarPromptRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setStep('year')}
                  style={({ pressed }) => [
                    styles.calendarBack,
                    { backgroundColor: colors.surfaceAlt },
                    pressed && styles.calendarPressed,
                  ]}>
                  <Text style={[styles.calendarBackText, { color: colors.text }]}>Back</Text>
                </Pressable>
                <Text style={[styles.calendarPrompt, { color: colors.text }]}>Choose a month in {year}</Text>
              </View>
              <View style={styles.calendarOptionGrid}>
                {MONTH_NAMES.map((name, candidateMonthIndex) => {
                  const disabled = monthIsDisabled(candidateMonthIndex);
                  const selected = candidateMonthIndex === monthIndex;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ disabled, selected }}
                      disabled={disabled}
                      key={name}
                      onPress={() => chooseMonth(candidateMonthIndex)}
                      style={({ pressed }) => [
                        styles.calendarOption,
                        { backgroundColor: colors.input, borderColor: colors.border },
                        selected && [styles.calendarOptionSelected, {
                          backgroundColor: colors.primary,
                          borderColor: colors.primary,
                        }],
                        disabled && [
                          styles.calendarOptionDisabled,
                          isDark && { opacity: 0.5 },
                        ],
                        pressed && !disabled && styles.calendarPressed,
                      ]}>
                      <Text style={[
                        styles.calendarOptionText,
                        { color: colors.text },
                        selected && [
                          styles.calendarOptionSelectedText,
                          { color: isDark ? colors.header : palette.white },
                        ],
                        disabled && [styles.calendarDisabledDayText, { color: colors.textMuted }],
                      ]}>
                        {name.slice(0, 3)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {step === 'day' ? (
            <View style={styles.calendarChoiceSection}>
              <View style={styles.calendarPromptRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setStep('month')}
                  style={({ pressed }) => [
                    styles.calendarBack,
                    { backgroundColor: colors.surfaceAlt },
                    pressed && styles.calendarPressed,
                  ]}>
                  <Text style={[styles.calendarBackText, { color: colors.text }]}>Back</Text>
                </Pressable>
                <Text style={[styles.calendarPrompt, { color: colors.text }]}>{MONTH_NAMES[monthIndex]} {year}</Text>
              </View>
              <View style={styles.calendarGrid}>
                {WEEKDAYS.map((weekday) => (
                  <Text key={weekday} style={[styles.calendarWeekday, { color: colors.textMuted }]}>{weekday}</Text>
                ))}
                {calendarDays(month).map((date, index) => {
                  if (!date) return <View key={`empty-${index}`} style={styles.calendarCell} />;
                  const disabled = date < minimumDate || date > maximumDate;
                  const selected = date === value;
                  return (
                    <Pressable
                      accessibilityLabel={formatDrawDate(date)}
                      accessibilityRole="button"
                      accessibilityState={{ disabled, selected }}
                      disabled={disabled}
                      key={date}
                      onPress={() => onSelect(date)}
                      style={({ pressed }) => [
                        styles.calendarCell,
                        selected && [styles.calendarSelected, { backgroundColor: colors.primary }],
                        disabled && [
                          styles.calendarDisabledDay,
                          isDark && { opacity: 0.48 },
                        ],
                        pressed && !disabled && styles.calendarPressed,
                      ]}>
                      <Text style={[
                        styles.calendarDay,
                        { color: colors.text },
                        selected && [
                          styles.calendarSelectedDay,
                          { color: isDark ? colors.header : palette.white },
                        ],
                        disabled && [styles.calendarDisabledDayText, { color: colors.textMuted }],
                      ]}>
                        {Number(date.slice(-2))}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function filterForConfig(draws: readonly LotteryDraw[], config: AnalysisConfig): LotteryDraw[] {
  const relevant = draws
    .filter(
      (draw) =>
        draw.logicalGameCode === config.gameCode &&
        (config.slot === 'ALL' || draw.gameCode === config.slot),
    )
    .sort((left, right) => left.date.localeCompare(right.date) || left.time.localeCompare(right.time));
  if (config.mode === 'latest') return relevant.slice(-config.drawCount);
  return relevant.filter((draw) => draw.date >= config.fromDate && draw.date <= config.toDate);
}

function FrequencyBars({ analysis }: { analysis: GameAnalysis }) {
  const { colors, isDark } = useAppTheme();
  const rows = [...analysis.frequency]
    .sort((left, right) => right.appearanceCount - left.appearanceCount || left.numericValue - right.numericValue)
    .slice(0, 12);
  const maximum = Math.max(1, ...rows.map((row) => row.appearanceCount));
  return (
    <View style={styles.barList}>
      {rows.map((row) => (
        <View key={row.numericValue} style={styles.barRow}>
          <Text style={[styles.barLabel, { color: colors.text }]}>{row.number}</Text>
          <View style={[styles.barTrack, { backgroundColor: colors.surfaceAlt }]}>
            <View
              style={[
                styles.bar,
                {
                  backgroundColor: row.temperature === 'Sample hot'
                    ? colors.danger
                    : row.temperature === 'Sample cold'
                      ? isDark ? colors.textMuted : palette.blue600
                      : colors.primary,
                },
                { width: `${Math.max(3, (row.appearanceCount / maximum) * 100)}%` as `${number}%` },
              ]}
            />
          </View>
          <Text style={[styles.barValue, { color: colors.textMuted }]}>{row.appearanceCount}</Text>
        </View>
      ))}
    </View>
  );
}

function ParityRows({ analysis }: { analysis: GameAnalysis }) {
  const { colors, isDark } = useAppTheme();
  const maximum = Math.max(1, ...analysis.parityDistribution.map((row) => Math.max(row.observedPct, row.theoreticalPct)));
  return (
    <View style={styles.parityList}>
      {analysis.parityDistribution.map((row) => (
        <View key={row.pattern} style={styles.parityRow}>
          <Text style={[styles.parityPattern, { color: colors.text }]}>{row.pattern}</Text>
          <View style={[
            styles.parityTrack,
            { backgroundColor: isDark ? colors.surfaceAlt : palette.gold100 },
          ]}>
            <View style={[
              styles.observedBar,
              {
                backgroundColor: colors.primary,
                width: `${(row.observedPct / maximum) * 100}%` as `${number}%`,
              },
            ]} />
          </View>
          <Text style={[styles.parityValue, { color: colors.primary }]}>{row.observedPct.toFixed(0)}%</Text>
          <Text style={[styles.fairValue, { color: colors.textMuted }]}>fair {row.theoreticalPct.toFixed(0)}%</Text>
        </View>
      ))}
    </View>
  );
}

function DrawScatter({ analysis }: { analysis: GameAnalysis }) {
  const { colors, isDark } = useAppTheme();
  const features = analysis.drawFeatures.slice(-30);
  const { minimum, maximum } = analysis.rule;
  const valueSpan = Math.max(1, maximum - minimum);
  const first = features[0];
  const last = features.at(-1);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Scatter plot of ${features.length} selected draw records, from values ${minimum} through ${maximum}.`}
      style={styles.scatterFigure}>
      <View style={styles.scatterRow}>
        <View style={styles.scatterYLabels}>
          <Text style={[styles.axisLabel, { color: colors.textMuted }]}>{maximum}</Text>
          <Text style={[styles.axisLabel, { color: colors.textMuted }]}>{Math.round((minimum + maximum) / 2)}</Text>
          <Text style={[styles.axisLabel, { color: colors.textMuted }]}>{minimum}</Text>
        </View>
        <View style={[
          styles.scatterPlot,
          { backgroundColor: isDark ? colors.input : colors.surface, borderColor: colors.border },
        ]}>
          {[0, 50, 100].map((position) => (
            <View
              key={position}
              style={[
                styles.scatterGridLine,
                { backgroundColor: colors.border, bottom: `${position}%` as `${number}%` },
              ]}
            />
          ))}
          {features.flatMap((feature, drawIndex) =>
            feature.numbers.map((number, numberIndex) => {
              const left = features.length === 1 ? 50 : 2 + (drawIndex / (features.length - 1)) * 96;
              const bottom = 2 + ((number - minimum) / valueSpan) * 96;
              return (
                <View
                  accessible={false}
                  key={`${feature.index}-${numberIndex}-${number}`}
                  style={[
                    styles.scatterDot,
                    analysis.rule.ordered && styles.orderedScatterDot,
                    {
                      backgroundColor: analysis.rule.ordered
                        ? isDark ? colors.danger : palette.purple600
                        : colors.primary,
                      left: `${left}%` as `${number}%`,
                      bottom: `${bottom}%` as `${number}%`,
                    },
                  ]}
                />
              );
            }),
          )}
        </View>
      </View>
      <View style={styles.axisDates}>
        <Text style={[styles.axisLabel, { color: colors.textMuted }]}>{first ? formatDrawDate(first.date) : ''}</Text>
        <Text style={[styles.axisLabel, { color: colors.textMuted }]}>{last ? formatDrawDate(last.date) : ''}</Text>
      </View>
    </View>
  );
}

function RollingFrequency({ analysis }: { analysis: GameAnalysis }) {
  const { colors, isDark } = useAppTheme();
  const features = analysis.drawFeatures;
  const windowSize = Math.min(5, features.length);
  const visibleStart = Math.max(0, features.length - 12);
  const topNumbers = [...analysis.frequency]
    .filter((row) => row.appearanceCount > 0)
    .sort((left, right) => right.appearanceCount - left.appearanceCount || left.numericValue - right.numericValue)
    .slice(0, 3);

  return (
    <View style={styles.rollingList}>
      {topNumbers.map((row) => {
        const values = features.slice(visibleStart).map((_, visibleIndex) => {
          const end = visibleStart + visibleIndex;
          const start = Math.max(0, end - windowSize + 1);
          return features
            .slice(start, end + 1)
            .reduce((count, feature) => count + feature.numbers.filter((number) => number === row.numericValue).length, 0);
        });
        const maximum = Math.max(1, ...values);
        const latest = values.at(-1) ?? 0;
        return (
          <View
            accessible
            accessibilityLabel={`Number ${row.number}: ${latest} appearances in the latest rolling window of ${windowSize} draws.`}
            key={row.numericValue}
            style={styles.rollingRow}>
            <Text style={[styles.rollingLabel, { color: colors.text }]}>{row.number}</Text>
            <View style={[
              styles.rollingBars,
              {
                backgroundColor: isDark ? colors.input : 'transparent',
                borderBottomColor: colors.border,
              },
            ]}>
              {values.map((value, index) => (
                <View key={index} style={styles.rollingColumn}>
                  <View style={[
                    styles.rollingBar,
                    { backgroundColor: colors.primary, height: Math.max(2, (value / maximum) * 26) },
                  ]} />
                </View>
              ))}
            </View>
            <Text style={[styles.rollingValue, { color: colors.primary }]}>{latest}</Text>
          </View>
        );
      })}
      <Text style={[styles.helper, { color: colors.textMuted }]}>
        Latest {windowSize}-draw windows. Newest is on the right.
      </Text>
    </View>
  );
}

function GapRows({ analysis }: { analysis: GameAnalysis }) {
  const { colors } = useAppTheme();
  const unseenCount = analysis.frequency.filter((row) => !row.seenInSelectedSample).length;
  const rows = [...analysis.frequency]
    .filter((row) => row.seenInSelectedSample)
    .sort(
      (left, right) =>
        (right.drawsSinceLast ?? 0) - (left.drawsSinceLast ?? 0) ||
        (right.meanGapDraws ?? 0) - (left.meanGapDraws ?? 0) ||
        left.numericValue - right.numericValue,
    )
    .slice(0, 8);
  return (
    <View style={styles.gapTable}>
      <View style={[
        styles.gapRow,
        styles.gapHeader,
        { backgroundColor: colors.surfaceAlt, borderBottomColor: colors.border },
      ]}>
        <Text style={[styles.gapCell, styles.gapNumber, { color: colors.text }]}>No.</Text>
        <Text style={[styles.gapCell, styles.gapMetric, { color: colors.text }]}>Since</Text>
        <Text style={[styles.gapCell, styles.gapMetric, { color: colors.text }]}>Avg gap</Text>
        <Text style={[styles.gapCell, styles.gapDate, { color: colors.text }]}>Last seen</Text>
      </View>
      {rows.map((row) => (
        <View
          accessible
          accessibilityLabel={`${row.number}: ${row.drawsSinceLast ?? 0} draws since last appearance; average gap ${row.meanGapDraws?.toFixed(1) ?? 'not available'}.`}
          key={row.numericValue}
          style={[styles.gapRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.gapCell, styles.gapNumber, styles.gapStrong, { color: colors.text }]}>{row.number}</Text>
          <Text style={[styles.gapCell, styles.gapMetric, { color: colors.textMuted }]}>{row.drawsSinceLast ?? 0}</Text>
          <Text style={[styles.gapCell, styles.gapMetric, { color: colors.textMuted }]}>{row.meanGapDraws?.toFixed(1) ?? '-'}</Text>
          <Text style={[styles.gapCell, styles.gapDate, { color: colors.textMuted }]}>{row.lastSeen ? formatDrawDate(row.lastSeen) : '-'}</Text>
        </View>
      ))}
      <Text style={[styles.helper, { color: colors.textMuted }]}>
        Not seen: {unseenCount}. Since means draws, not days.
      </Text>
    </View>
  );
}

function Tag({ label, tone }: { label: string; tone: 'hot' | 'cold' | 'neutral' }) {
  const { colors, isDark } = useAppTheme();
  return (
    <Text style={[
      styles.tag,
      { backgroundColor: colors.surfaceAlt, color: colors.text },
      tone === 'hot' && [
        styles.hotTag,
        isDark && { backgroundColor: colors.danger, color: colors.header },
      ],
      tone === 'cold' && [
        styles.coldTag,
        isDark && { backgroundColor: colors.primary, color: colors.header },
      ],
    ]}>
      {label}
    </Text>
  );
}

function topPositionRows(analysis: GameAnalysis): { position: number; rows: FrequencyRow[] }[] {
  if (!analysis.rule.ordered) return [];
  return Array.from({ length: analysis.rule.pickCount }, (_, index) => {
    const rows = analysis.positionFrequency
      .filter((row) => row.position === index + 1)
      .sort((left, right) => right.count - left.count || left.numericValue - right.numericValue)
      .slice(0, 3)
      .map((row) => ({
        number: row.number,
        numericValue: row.numericValue,
        appearanceCount: row.count,
        appearanceSharePct: row.ratePct,
        drawHitCount: row.count,
        drawHitRatePct: row.ratePct,
        expectedCount: 0,
        differenceFromExpected: 0,
        seenInSelectedSample: row.count > 0,
        drawsSinceLast: null,
        meanGapDraws: null,
        maximumGapDraws: null,
        lastSeen: null,
        temperature: 'Middle' as const,
      }));
    return { position: index + 1, rows };
  });
}

export default function AnalysisScreen() {
  const { draws } = useDraws();
  const { colors, isDark } = useAppTheme();
  const { adsEnabled, runBeforeAnalysis } = useAnalysisInterstitial();
  const availableEnd = useMemo(() => draws.reduce((latest, draw) => (draw.date > latest ? draw.date : latest), ''), [draws]);
  const availableStart = useMemo(() => draws.reduce((earliest, draw) => (!earliest || draw.date < earliest ? draw.date : earliest), ''), [draws]);
  const initialEnd = availableEnd || '2026-08-05';
  const initialStart = minusDays(initialEnd, 90);
  const [gameCode, setGameCode] = useState<LogicalGameCode>('LOTTO42');
  const [mode, setMode] = useState<AnalysisMode>('latest');
  const [drawCountInput, setDrawCountInput] = useState('10');
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotFilter>('ALL');
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [candidateVariant, setCandidateVariant] = useState(0);
  const [candidateSeed, setCandidateSeed] = useState(() => Math.floor(Math.random() * 0x1_0000_0000));
  const [calendarTarget, setCalendarTarget] = useState<CalendarTarget | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(initialEnd.slice(0, 7));
  const [resetGeneration, setResetGeneration] = useState(0);
  const [config, setConfig] = useState<AnalysisConfig>({
    gameCode: 'LOTTO42',
    mode: 'latest',
    drawCount: 10,
    fromDate: initialStart,
    toDate: initialEnd,
    slot: 'ALL',
  });

  const resetAnalysis = useCallback(() => {
    setGameCode('LOTTO42');
    setMode('latest');
    setDrawCountInput('10');
    setFromDate(null);
    setToDate(null);
    setSlot('ALL');
    setSelectionError(null);
    setHasAnalyzed(false);
    setCandidateVariant(0);
    setCandidateSeed(Math.floor(Math.random() * 0x1_0000_0000));
    setCalendarTarget(null);
    setCalendarMonth(initialEnd.slice(0, 7));
    setConfig({
      gameCode: 'LOTTO42',
      mode: 'latest',
      drawCount: 10,
      fromDate: initialStart,
      toDate: initialEnd,
      slot: 'ALL',
    });
    // Remount the controls so their collapsed/expanded state also returns to default.
    setResetGeneration((current) => current + 1);
  }, [initialEnd, initialStart]);

  useEffect(() => {
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (previousState === 'active' && nextState !== 'active') {
        resetAnalysis();
      }
      previousState = nextState;
    });

    return () => subscription.remove();
  }, [resetAnalysis]);

  const inputRule = GAME_BY_CODE[gameCode];
  const selectedRule = GAME_BY_CODE[config.gameCode];
  const resolvedToDate = toDate ?? initialEnd;
  const resolvedFromDate = fromDate ?? minusDays(resolvedToDate, 90);
  const archiveStart = availableStart || initialStart;
  const archiveEnd = availableEnd || initialEnd;

  const selectedDraws = useMemo(() => filterForConfig(draws, config), [config, draws]);
  const analysis = useMemo(
    () => hasAnalyzed
      ? analyzeGame(selectedDraws, selectedRule, { seed: candidateSeed, candidateVariant, candidatePoolSize: 2500 })
      : null,
    [candidateSeed, candidateVariant, hasAnalyzed, selectedDraws, selectedRule],
  );
  const positionRows = useMemo(() => analysis ? topPositionRows(analysis) : [], [analysis]);

  const apply = () => {
    const requestedDrawCount = Number(drawCountInput);
    if (
      mode === 'latest' &&
      (!/^[1-9]\d*$/.test(drawCountInput) || !Number.isSafeInteger(requestedDrawCount))
    ) {
      setSelectionError('Number of draws must be a positive whole number.');
      return;
    }
    if (mode === 'date' && (!isValidIsoDate(resolvedFromDate) || !isValidIsoDate(resolvedToDate))) {
      setSelectionError('Enter real calendar dates as YYYY-MM-DD.');
      return;
    }
    if (mode === 'date' && resolvedFromDate > resolvedToDate) {
      setSelectionError('Start date must be on or before end date.');
      return;
    }
    runBeforeAnalysis(() => {
      setConfig({
        gameCode,
        mode,
        drawCount: mode === 'latest' ? requestedDrawCount : config.drawCount,
        fromDate: resolvedFromDate,
        toDate: resolvedToDate,
        slot,
      });
      setHasAnalyzed(true);
      setCandidateVariant(0);
      setSelectionError(null);
    });
  };

  const handleGameChange = (next: LogicalGameCode) => {
    setGameCode(next);
    setSlot('ALL');
    setSelectionError(null);
  };

  const openCalendar = (target: CalendarTarget) => {
    const selectedDate = target === 'from' ? resolvedFromDate : resolvedToDate;
    setCalendarMonth(selectedDate.slice(0, 7));
    setCalendarTarget(target);
    setSelectionError(null);
  };

  const selectCalendarDate = (date: string) => {
    if (calendarTarget === 'from') setFromDate(date);
    if (calendarTarget === 'to') setToDate(date);
    setCalendarTarget(null);
    setSelectionError(null);
  };

  const candidate = analysis?.recommendedCandidate ?? null;
  const commonParity = analysis?.parityDistribution.length
    ? [...analysis.parityDistribution]
        .sort((left, right) => right.drawCount - left.drawCount || left.evenCount - right.evenCount)[0]
    : null;
  const scope = analysis?.summary.drawCount
    ? `${analysis.summary.drawCount} draw${analysis.summary.drawCount === 1 ? '' : 's'} | ${formatDrawDate(analysis.summary.selectedStartDate ?? '')} - ${formatDrawDate(analysis.summary.selectedEndDate ?? '')}`
    : 'No records match this selection';

  return (
    <>
    <Screen key={`analysis-screen-${resetGeneration}`} scrollToTopOnFocus title="Analysis">
      <CollapsibleSectionCard
        defaultCollapsed={hasAnalyzed}
        key={hasAnalyzed ? 'draw-picker-results' : 'draw-picker-start'}
        title="Choose draws">
        <GamePicker value={gameCode} onChange={handleGameChange} />
        {inputRule.slots ? (
          <View style={styles.controlGroup}>
            <Text style={[styles.controlLabel, { color: colors.text }]}>Time</Text>
            <SegmentedControl
              accessibilityLabel="Choose analysis draw slot"
              value={slot}
              onChange={setSlot}
              segments={[
                { label: 'All', value: 'ALL' as const },
                ...inputRule.slots.map((item) => ({ label: item.label, value: item.gameCode })),
              ]}
            />
          </View>
        ) : null}
        <SegmentedControl
          accessibilityLabel="Choose analysis draw selection mode"
          value={mode}
          onChange={(value) => {
            setMode(value);
            setSelectionError(null);
          }}
          segments={[{ label: 'Latest', value: 'latest' }, { label: 'By date', value: 'date' }]}
        />
        {mode === 'latest' ? (
          <Field label="Draws">
            <AppTextInput
              accessibilityLabel="Number of latest draws"
              inputMode="numeric"
              keyboardType="number-pad"
              onChangeText={(value) => {
                setDrawCountInput(value);
                setSelectionError(null);
              }}
              placeholder="10"
              value={drawCountInput}
            />
          </Field>
        ) : (
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <DateFieldButton
                label="From"
                onPress={() => openCalendar('from')}
                value={resolvedFromDate}
              />
            </View>
            <View style={styles.dateField}>
              <DateFieldButton
                label="To"
                onPress={() => openCalendar('to')}
                value={resolvedToDate}
              />
            </View>
          </View>
        )}
        {selectionError ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>{selectionError}</Text>
        ) : null}
        <ActionButton label="Analyze" icon="analytics" onPress={apply} />
        {adsEnabled ? (
          <Text style={[styles.adNotice, { color: colors.textMuted }]}>Ad may appear.</Text>
        ) : null}
      </CollapsibleSectionCard>

      {hasAnalyzed && analysis ? (
        <>
          <View style={[
            styles.scopeRow,
            isDark && {
              paddingVertical: spacing.xs,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceAlt,
            },
          ]}>
            <View style={[styles.scopeDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.scopeText, { color: colors.textMuted }]}>{selectedRule.name} | {scope}</Text>
          </View>

      {analysis.summary.drawCount === 0 ? (
        <CollapsibleSectionCard title="No matching draws">
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>Try another game, time, or date.</Text>
        </CollapsibleSectionCard>
      ) : (
        <>
          <CollapsibleSectionCard title="At a glance">
            <View style={styles.statsGrid}>
              <StatCard label="Draws" value={formatCount(analysis.summary.drawCount)} tone="teal" />
              <StatCard
                label="Common mix"
                value={commonParity ? `${commonParity.evenCount} even / ${commonParity.oddCount} odd` : 'N/A'}
              />
              <StatCard label="Average total" value={analysis.sumStatistics.average?.toFixed(1) ?? 'N/A'} />
              <StatCard
                label="Repeated a number"
                value={analysis.previousOverlap.comparisons ? `${analysis.previousOverlap.drawsSharingAtLeastOne} of ${analysis.previousOverlap.comparisons}` : 'N/A'}
                tone="gold"
              />
            </View>
            <View style={styles.quickGroup}>
              <Text style={[styles.resultLabel, { color: colors.text }]}>Most seen</Text>
              <View style={styles.tagRow}>
                {analysis.hotNumbers.slice(0, 6).map((number) => <Tag key={`hot-${number}`} tone="hot" label={formatNumber(number, selectedRule)} />)}
                {!analysis.hotNumbers.length ? <Tag tone="neutral" label="Tied" /> : null}
              </View>
            </View>
            <View style={styles.quickGroup}>
              <Text style={[styles.resultLabel, { color: colors.text }]}>Least seen</Text>
              <View style={styles.tagRow}>
                {analysis.coldNumbers.slice(0, 6).map((number) => <Tag key={`cold-${number}`} tone="cold" label={formatNumber(number, selectedRule)} />)}
                {!analysis.coldNumbers.length ? <Tag tone="neutral" label="Tied" /> : null}
              </View>
            </View>
          </CollapsibleSectionCard>

          {candidate ? (
            <CollapsibleSectionCard
              title="Suggested numbers"
              right={<ActionButton label="New pick" icon="shuffle" variant="secondary" onPress={() => setCandidateVariant((value) => value + 1)} />}>
              <NumberBalls numbers={[...candidate.numbers]} rule={selectedRule} />
              <View style={styles.candidateFacts}>
                <Text style={[styles.candidateFact, { backgroundColor: colors.surfaceAlt, color: colors.text }]}>{candidate.evenCount} even / {candidate.oddCount} odd</Text>
                <Text style={[styles.candidateFact, { backgroundColor: colors.surfaceAlt, color: colors.text }]}>Total {candidate.sum}</Text>
              </View>
              <Text style={[styles.odds, { color: colors.danger }]}>Equal odds: 1 in {formatCount(candidate.theoreticalOddsOneIn)}</Text>
            </CollapsibleSectionCard>
          ) : null}

          <Text style={[styles.groupTitle, { color: colors.textMuted }]}>MORE DETAILS</Text>

          <CollapsibleSectionCard defaultCollapsed title="Most seen numbers">
            <FrequencyBars analysis={analysis} />
            <Text style={[styles.helper, { color: colors.textMuted }]}>Not seen does not mean due.</Text>
          </CollapsibleSectionCard>

          <CollapsibleSectionCard
            defaultCollapsed
            title="Number chart"
            subtitle={`Each dot is a number from the latest ${Math.min(30, analysis.summary.drawCount)} draws.`}>
            <DrawScatter analysis={analysis} />
          </CollapsibleSectionCard>

          <CollapsibleSectionCard defaultCollapsed title="Recent trend" subtitle="The three most-seen numbers over time.">
            <RollingFrequency analysis={analysis} />
          </CollapsibleSectionCard>

          <CollapsibleSectionCard defaultCollapsed title="Last seen" subtitle="Measured in draws, not days.">
            <GapRows analysis={analysis} />
          </CollapsibleSectionCard>

          <CollapsibleSectionCard defaultCollapsed title="Even and odd" subtitle="Actual results compared with expected results.">
            <ParityRows analysis={analysis} />
          </CollapsibleSectionCard>

          <CollapsibleSectionCard defaultCollapsed title="Other patterns">
            <View style={styles.statsGrid}>
              <StatCard label="Total range" value={`${analysis.sumStatistics.minimum}-${analysis.sumStatistics.maximum}`} />
              <StatCard label="With consecutive" value={`${analysis.consecutive.drawsWithConsecutive} of ${analysis.summary.drawCount}`} />
              <StatCard label={selectedRule.ordered ? 'Common step' : 'Common pair'} value={analysis.pairFrequency[0]?.key ?? 'None'} />
              <StatCard label="Common triple" value={analysis.tripleFrequency[0]?.key ?? 'None'} />
            </View>
            <Text style={[styles.helper, { color: colors.textMuted }]}>Low: {selectedRule.minimum}-{analysis.summary.lowBoundary} | High: {analysis.summary.highBoundary}-{selectedRule.maximum}</Text>
            <View style={styles.tagRow}>
              {analysis.lowHighDistribution.slice(0, 5).map((row) => (
                <Tag key={row.pattern} tone="neutral" label={`${row.pattern}: ${row.drawCount}`} />
              ))}
            </View>
            <Text style={[styles.patternLabel, { color: colors.text }]}>{selectedRule.ordered ? 'Common steps' : 'Common pairs'}</Text>
            <View style={styles.tagRow}>
              {analysis.pairFrequency.slice(0, 5).map((row) => (
                <Tag key={row.key} tone="neutral" label={`${row.key}: ${row.drawSupportCount} draw${row.drawSupportCount === 1 ? '' : 's'}`} />
              ))}
            </View>
            <Text style={[styles.patternLabel, { color: colors.text }]}>Common triples</Text>
            <View style={styles.tagRow}>
              {analysis.tripleFrequency.slice(0, 5).map((row) => (
                <Tag key={row.key} tone="neutral" label={`${row.key}: ${row.drawSupportCount} draw${row.drawSupportCount === 1 ? '' : 's'}`} />
              ))}
            </View>
          </CollapsibleSectionCard>

          {selectedRule.ordered ? (
            <CollapsibleSectionCard defaultCollapsed title="By position" subtitle="For exact-order games.">
              {positionRows.map(({ position, rows }) => (
                <View key={position} style={[styles.positionRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.positionLabel, { color: colors.text }]}>Position {position}</Text>
                  <View style={styles.tagRow}>
                    {rows.map((row) => <Tag key={`${position}-${row.numericValue}`} tone="neutral" label={`${row.number}: ${row.appearanceCount}`} />)}
                  </View>
                </View>
              ))}
            </CollapsibleSectionCard>
          ) : null}
        </>
      )}
        </>
      ) : null}

      <Notice tone="warning">
        18+. Past results cannot predict the next draw. Every valid combination has equal odds.
      </Notice>
    </Screen>
    {calendarTarget ? (
      <CalendarModal
        archiveMaximumDate={archiveEnd}
        archiveMinimumDate={archiveStart}
        maximumDate={calendarTarget === 'from' && resolvedToDate < archiveEnd ? resolvedToDate : archiveEnd}
        minimumDate={calendarTarget === 'to' && resolvedFromDate > archiveStart ? resolvedFromDate : archiveStart}
        month={calendarMonth}
        onClose={() => setCalendarTarget(null)}
        onMonthChange={setCalendarMonth}
        onSelect={selectCalendarDate}
        title={`Choose ${calendarTarget === 'from' ? 'start' : 'end'} date`}
        value={calendarTarget === 'from' ? resolvedFromDate : resolvedToDate}
      />
    ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  controlGroup: { gap: spacing.sm },
  controlLabel: { color: palette.navy900, fontSize: 12, fontWeight: '900' },
  helper: { color: palette.slate600, fontSize: 11, lineHeight: 16 },
  adNotice: { color: palette.slate600, fontSize: 10, lineHeight: 14, textAlign: 'center' },
  dateRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  dateField: { flex: 1 },
  dateButton: {
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: palette.slate300,
    borderRadius: radius.md,
    backgroundColor: palette.white,
  },
  dateButtonPressed: { opacity: 0.72, backgroundColor: palette.slate50 },
  dateButtonValue: { color: palette.navy900, fontSize: 12, fontWeight: '900' },
  dateButtonAction: { color: palette.teal700, fontSize: 10, fontWeight: '900' },
  calendarBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(0, 27, 62, 0.5)',
  },
  calendarDismiss: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  calendarCard: {
    width: '100%',
    maxWidth: 420,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    backgroundColor: palette.white,
  },
  calendarTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  calendarTitleCopy: { flex: 1, gap: 3 },
  calendarTitle: { color: palette.navy900, fontSize: 17, fontWeight: '900' },
  calendarRange: { color: palette.slate600, fontSize: 10, lineHeight: 15 },
  calendarClose: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: palette.slate100,
  },
  calendarCloseText: { color: palette.navy900, fontSize: 10, fontWeight: '900' },
  calendarSteps: { flexDirection: 'row', gap: 4 },
  calendarStep: {
    flex: 1,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
    backgroundColor: palette.slate100,
  },
  calendarStepActive: { backgroundColor: palette.teal700 },
  calendarStepComplete: { backgroundColor: palette.teal100 },
  calendarStepText: { color: palette.slate500, fontSize: 9, fontWeight: '800' },
  calendarStepTextComplete: { color: palette.navy900 },
  calendarStepTextActive: { color: palette.white },
  calendarChoiceSection: { gap: spacing.md },
  calendarPromptRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  calendarPrompt: { flex: 1, color: palette.navy900, fontSize: 13, fontWeight: '900', textAlign: 'center' },
  calendarBack: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: palette.slate100,
  },
  calendarBackText: { color: palette.navy900, fontSize: 10, fontWeight: '900' },
  calendarOptionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  calendarOption: {
    minHeight: 42,
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.slate200,
    borderRadius: radius.md,
    backgroundColor: palette.slate50,
  },
  calendarOptionSelected: { borderColor: palette.teal700, backgroundColor: palette.teal700 },
  calendarOptionDisabled: { opacity: 0.28 },
  calendarOptionText: { color: palette.navy900, fontSize: 12, fontWeight: '800' },
  calendarOptionSelectedText: { color: palette.white, fontWeight: '900' },
  calendarPressed: { opacity: 0.65 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarWeekday: {
    width: '14.2857%',
    paddingVertical: 6,
    color: palette.slate600,
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
  },
  calendarCell: {
    width: '14.2857%',
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  calendarDay: { color: palette.slate800, fontSize: 12, fontWeight: '700' },
  calendarSelected: { backgroundColor: palette.teal700 },
  calendarSelectedDay: { color: palette.white, fontWeight: '900' },
  calendarDisabledDay: { opacity: 0.26 },
  calendarDisabledDayText: { color: palette.slate500 },
  error: { color: palette.coral600, fontSize: 12, fontWeight: '700' },
  scopeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xs },
  scopeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.teal600 },
  scopeText: { flex: 1, color: palette.slate600, fontSize: 11 },
  emptyText: { color: palette.slate600, fontSize: 13, lineHeight: 19 },
  groupTitle: { paddingHorizontal: spacing.xs, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  quickGroup: { gap: 6 },
  resultLabel: { color: palette.navy900, fontSize: 11, fontWeight: '900' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.pill, overflow: 'hidden', color: palette.slate700, backgroundColor: palette.slate100, fontSize: 10, fontWeight: '800' },
  hotTag: { color: '#9F2424', backgroundColor: palette.coral100 },
  coldTag: { color: '#1D4E89', backgroundColor: palette.blue100 },
  candidateFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  candidateFact: { color: palette.slate700, backgroundColor: palette.slate100, paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.sm, fontSize: 10, fontWeight: '700' },
  odds: { color: palette.coral600, fontSize: 11, fontWeight: '900' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  barList: { gap: 7 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barLabel: { width: 28, color: palette.navy900, fontSize: 11, fontWeight: '900' },
  barTrack: { flex: 1, height: 12, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: palette.slate100 },
  bar: { height: '100%', borderRadius: radius.pill, backgroundColor: palette.teal600 },
  barValue: { width: 24, color: palette.slate700, fontSize: 11, textAlign: 'right' },
  parityList: { gap: spacing.sm },
  parityRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  parityPattern: { width: 45, color: palette.navy900, fontSize: 10, fontWeight: '900' },
  parityTrack: { flex: 1, height: 11, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: palette.gold100 },
  observedBar: { height: '100%', borderRadius: radius.pill, backgroundColor: palette.teal600 },
  parityValue: { width: 34, color: palette.teal700, fontSize: 10, fontWeight: '800', textAlign: 'right' },
  fairValue: { width: 50, color: palette.slate500, fontSize: 9, textAlign: 'right' },
  scatterFigure: { gap: spacing.xs },
  scatterRow: { height: 148, flexDirection: 'row', gap: spacing.sm },
  scatterYLabels: { width: 28, justifyContent: 'space-between', alignItems: 'flex-end' },
  scatterPlot: { flex: 1, position: 'relative', overflow: 'hidden', borderLeftWidth: 1, borderBottomWidth: 1, borderColor: palette.slate300 },
  scatterGridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: palette.slate200 },
  scatterDot: { position: 'absolute', width: 7, height: 7, marginLeft: -3.5, marginBottom: -3.5, borderRadius: 4, backgroundColor: palette.blue600, opacity: 0.78 },
  orderedScatterDot: { borderRadius: 1, backgroundColor: palette.purple600 },
  axisDates: { marginLeft: 36, flexDirection: 'row', justifyContent: 'space-between' },
  axisLabel: { color: palette.slate500, fontSize: 9 },
  rollingList: { gap: spacing.sm },
  rollingRow: { minHeight: 34, flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  rollingLabel: { width: 28, color: palette.navy900, fontSize: 11, fontWeight: '900', paddingBottom: 3 },
  rollingBars: { flex: 1, height: 30, flexDirection: 'row', alignItems: 'flex-end', gap: 3, borderBottomWidth: 1, borderBottomColor: palette.slate300 },
  rollingColumn: { flex: 1, height: 28, justifyContent: 'flex-end' },
  rollingBar: { minHeight: 2, borderTopLeftRadius: 2, borderTopRightRadius: 2, backgroundColor: palette.teal600 },
  rollingValue: { width: 22, color: palette.teal700, fontSize: 11, fontWeight: '900', textAlign: 'right', paddingBottom: 3 },
  gapTable: { gap: 0 },
  gapRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: palette.slate100 },
  gapHeader: { minHeight: 28, backgroundColor: palette.slate50 },
  gapCell: { color: palette.slate700, fontSize: 10, paddingHorizontal: 4 },
  gapNumber: { width: 42 },
  gapMetric: { width: 54, textAlign: 'right' },
  gapDate: { flex: 1, textAlign: 'right' },
  gapStrong: { color: palette.navy900, fontWeight: '900' },
  patternLabel: { color: palette.navy900, fontSize: 11, fontWeight: '900', marginTop: spacing.xs },
  positionRow: { gap: 6, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: palette.slate100 },
  positionLabel: { color: palette.navy900, fontSize: 11, fontWeight: '900' },
});
