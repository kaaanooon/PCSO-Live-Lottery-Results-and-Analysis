import { useState, type ReactNode } from 'react';
import {
  BarChart,
  LineChart,
  PieChart,
  type DataSet,
  type barDataItem,
  type lineDataItem,
  type pieDataItem,
} from 'react-native-gifted-charts';
import {
  Circle,
  Line,
  Svg,
  Text as SvgText,
} from 'react-native-svg';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import type { GameAnalysis } from '@/domain/analysis';
import { useAppTheme } from '@/providers/preferences-provider';
import { palette, radius, spacing } from '@/theme/tokens';

const SERIES_COLORS = [
  palette.blue600,
  palette.coral600,
  palette.gold500,
  '#0F9F8F',
  '#7C5CE5',
  '#D9468D',
] as const;

function shortDate(date: string): string {
  const [, month, day] = date.split('-');
  return month && day ? `${month}/${day}` : date;
}

function chartPlotWidth(containerWidth: number): number {
  return Math.max(180, Math.floor(containerWidth - 48));
}

function ChartFrame({
  accessibilityLabel,
  height,
  children,
}: {
  accessibilityLabel: string;
  height: number;
  children: (width: number) => ReactNode;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    setWidth((current) => current === next ? current : next);
  };

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      onLayout={onLayout}
      style={[styles.chartFrame, { minHeight: height }]}>
      {width > 0 ? children(width) : null}
    </View>
  );
}

function ChartLegend({
  items,
}: {
  items: readonly {
    label: string;
    color: string;
    detail?: string;
  }[];
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.legend}>
      {items.map((item) => (
        <View key={item.label} style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
          <Text style={[styles.legendLabel, { color: colors.text }]}>
            {item.label}{item.detail ? ` ${item.detail}` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ScrollHint() {
  const { colors } = useAppTheme();
  return <Text style={[styles.scrollHint, { color: colors.textMuted }]}>Swipe sideways to see every label.</Text>;
}

function chartTextStyle(color: string) {
  return { color, fontSize: 9, fontWeight: '700' as const };
}

export function DrawScatterChart({ analysis }: { analysis: GameAnalysis }) {
  const { colors } = useAppTheme();
  const features = analysis.drawFeatures;
  const ordered = analysis.rule.ordered;
  const { minimum, maximum } = analysis.rule;
  const valueSpan = Math.max(1, maximum - minimum);
  const yTicks = Array.from({ length: 5 }, (_, index) =>
    Math.round(maximum - (valueSpan * index) / 4),
  );
  const chartHeight = 238;
  const plotTop = 14;
  const plotBottom = 202;
  const plotHeight = plotBottom - plotTop;
  const leftInset = 34;
  const rightInset = 18;
  const dateSpacing = 62;

  return (
    <>
      <ChartFrame
        accessibilityLabel={`Scatter chart containing ${analysis.summary.numberObservations} drawn values across ${features.length} draws. The horizontal axis is draw date and the vertical axis is number.`}
        height={250}>
        {(width) => {
          const contentWidth = Math.max(
            width - 2,
            leftInset + rightInset + Math.max(1, features.length - 1) * dateSpacing,
          );
          const xForDraw = (drawIndex: number) =>
            features.length === 1
              ? contentWidth / 2
              : leftInset + drawIndex * dateSpacing;
          const yForNumber = (number: number) =>
            plotTop + ((maximum - number) / valueSpan) * plotHeight;

          return (
            <View style={[styles.svgChartShell, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <ScrollView
                contentContainerStyle={styles.svgScrollContent}
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator>
                <Svg height={chartHeight} width={contentWidth}>
                  {yTicks.map((tick) => {
                    const y = yForNumber(tick);
                    return (
                      <Line
                        key={`horizontal-${tick}`}
                        stroke={colors.border}
                        strokeWidth={StyleSheet.hairlineWidth}
                        x1={leftInset}
                        x2={contentWidth - rightInset}
                        y1={y}
                        y2={y}
                      />
                    );
                  })}
                  {features.map((feature, drawIndex) => {
                    const x = xForDraw(drawIndex);
                    return (
                      <Line
                        key={`vertical-${feature.index}-${feature.date}-${feature.time}`}
                        stroke={colors.border}
                        strokeWidth={StyleSheet.hairlineWidth}
                        x1={x}
                        x2={x}
                        y1={plotTop}
                        y2={plotBottom}
                      />
                    );
                  })}
                  {yTicks.map((tick) => (
                    <SvgText
                      fill={colors.textMuted}
                      fontSize={9}
                      fontWeight="700"
                      key={`label-${tick}`}
                      textAnchor="end"
                      x={leftInset - 7}
                      y={yForNumber(tick) + 3}>
                      {tick}
                    </SvgText>
                  ))}
                  {features.map((feature, drawIndex) => {
                    const x = xForDraw(drawIndex);
                    return (
                      <SvgText
                        fill={colors.textMuted}
                        fontSize={9}
                        fontWeight="700"
                        key={`date-${feature.index}-${feature.date}-${feature.time}`}
                        textAnchor="middle"
                        x={x}
                        y={225}>
                        {shortDate(feature.date)}
                      </SvgText>
                    );
                  })}
                  {features.flatMap((feature, drawIndex) =>
                    feature.numbers.map((number, position) => {
                      const positionOffset = ordered
                        ? (position - (feature.numbers.length - 1) / 2) * 2.2
                        : 0;
                      return (
                        <Circle
                          cx={xForDraw(drawIndex) + positionOffset}
                          cy={yForNumber(number)}
                          fill={ordered
                            ? SERIES_COLORS[position % SERIES_COLORS.length]
                            : colors.primary}
                          key={`${feature.index}-${feature.date}-${feature.time}-${position}-${number}`}
                          opacity={0.9}
                          r={ordered ? 3.5 : 4}
                        />
                      );
                    }),
                  )}
                </Svg>
              </ScrollView>
            </View>
          );
        }}
      </ChartFrame>
      <ScrollHint />
      {ordered ? (
        <ChartLegend
          items={Array.from({ length: analysis.rule.pickCount }, (_, index) => ({
            label: `Position ${index + 1}`,
            color: SERIES_COLORS[index % SERIES_COLORS.length],
          }))}
        />
      ) : (
        <Text style={[styles.caption, { color: colors.textMuted }]}>Each dot is one drawn number. Exact combinations are listed below.</Text>
      )}
    </>
  );
}

function equalTrendHalves(analysis: GameAnalysis) {
  const halfSize = Math.floor(analysis.drawFeatures.length / 2);
  const compared = analysis.drawFeatures.slice(-halfSize * 2);
  return {
    older: compared.slice(0, halfSize),
    recent: compared.slice(halfSize),
  };
}

export function FrequencyTrendChart({ analysis }: { analysis: GameAnalysis }) {
  const { colors } = useAppTheme();
  const { older, recent } = equalTrendHalves(analysis);
  if (!older.length || !recent.length) {
    return <Text style={[styles.caption, { color: colors.textMuted }]}>At least two draws are needed to compare a trend.</Text>;
  }

  const count = (numbers: readonly number[], value: number) =>
    numbers.filter((number) => number === value).length;
  const rows = [...analysis.frequency]
    .sort((left, right) => left.numericValue - right.numericValue)
    .map((row) => {
      const olderCount = older.reduce((total, draw) => total + count(draw.numbers, row.numericValue), 0);
      const recentCount = recent.reduce((total, draw) => total + count(draw.numbers, row.numericValue), 0);
      return { row, olderCount, recentCount, difference: recentCount - olderCount };
    });
  const labelEvery = rows.length <= 12 ? 1 : 5;
  const data: lineDataItem[] = rows.map(({ row, olderCount }, index) => ({
    value: olderCount,
    label: index % labelEvery === 0 || index === rows.length - 1 ? row.number : '',
    dataPointText: rows.length <= 12 ? String(olderCount) : undefined,
  }));
  const data2: lineDataItem[] = rows.map(({ recentCount }) => ({
    value: recentCount,
    dataPointText: rows.length <= 12 ? String(recentCount) : undefined,
  }));
  const maximum = Math.max(1, ...rows.flatMap((row) => [row.olderCount, row.recentCount]));
  const strongest = [...rows]
    .sort((left, right) => Math.abs(right.difference) - Math.abs(left.difference) || left.row.numericValue - right.row.numericValue)
    .slice(0, 6);

  return (
    <>
      <ChartLegend
        items={[
          { label: `Older ${older.length} draws`, color: palette.blue600 },
          { label: `Newer ${recent.length} draws`, color: palette.coral600 },
        ]}
      />
      <ChartFrame
        accessibilityLabel={`Line chart comparing number counts in ${older.length} older draws with ${recent.length} newer draws.`}
        height={245}>
        {(width) => (
          <LineChart
            backgroundColor="transparent"
            color1={palette.blue600}
            color2={palette.coral600}
            data={data}
            data2={data2}
            dataPointsColor1={palette.blue600}
            dataPointsColor2={palette.coral600}
            dataPointsRadius1={3}
            dataPointsRadius2={3}
            disableForeignObject
            height={190}
            initialSpacing={12}
            maxValue={maximum}
            nestedScrollEnabled
            noOfSections={Math.min(4, maximum)}
            rulesColor={colors.border}
            showScrollIndicator
            showValuesAsDataPointsText={rows.length <= 12}
            spacing={rows.length <= 12 ? 40 : 30}
            textColor1={palette.blue600}
            textColor2={palette.coral600}
            textFontSize={8}
            thickness1={2}
            thickness2={2}
            width={chartPlotWidth(width)}
            xAxisColor={colors.border}
            xAxisLabelsHeight={28}
            xAxisTextNumberOfLines={1}
            xAxisLabelTextStyle={chartTextStyle(colors.textMuted)}
            yAxisColor={colors.border}
            yAxisTextStyle={chartTextStyle(colors.textMuted)}
          />
        )}
      </ChartFrame>
      <ScrollHint />
      <Text style={[styles.miniTitle, { color: colors.text }]}>Largest changes</Text>
      <View style={styles.changeList}>
        {strongest.map(({ row, olderCount, recentCount, difference }) => (
          <View key={row.numericValue} style={[styles.changePill, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Text style={[styles.changeNumber, { color: colors.text }]}>{row.number}</Text>
            <Text style={[styles.changeValue, { color: difference > 0 ? colors.danger : difference < 0 ? colors.primary : colors.textMuted }]}>
              {olderCount}→{recentCount} ({difference > 0 ? '+' : ''}{difference})
            </Text>
          </View>
        ))}
      </View>
    </>
  );
}

export function GapDetailsTable({ analysis }: { analysis: GameAnalysis }) {
  const { colors } = useAppTheme();
  const rows = [...analysis.frequency].sort((left, right) => {
    if (left.drawsSinceLast === null && right.drawsSinceLast !== null) return -1;
    if (right.drawsSinceLast === null && left.drawsSinceLast !== null) return 1;
    return (right.drawsSinceLast ?? 0) - (left.drawsSinceLast ?? 0) || left.numericValue - right.numericValue;
  });

  return (
    <>
      <View style={[styles.gapHeader, { backgroundColor: colors.surfaceAlt }]}>
        <Text style={[styles.gapHeaderText, styles.gapNumber, { color: colors.textMuted }]}>NO.</Text>
        <Text style={[styles.gapHeaderText, styles.gapMetric, { color: colors.textMuted }]}>SINCE</Text>
        <Text style={[styles.gapHeaderText, styles.gapMetric, { color: colors.textMuted }]}>AVG</Text>
        <Text style={[styles.gapHeaderText, styles.gapDate, { color: colors.textMuted }]}>LAST</Text>
      </View>
      {rows.map((row) => (
        <View key={row.numericValue} style={[styles.gapRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.gapNumber, styles.gapTextStrong, { color: colors.text }]}>{row.number}</Text>
          <Text style={[styles.gapMetric, styles.gapText, { color: colors.text }]}>{row.drawsSinceLast ?? 'Not seen'}</Text>
          <Text style={[styles.gapMetric, styles.gapText, { color: colors.textMuted }]}>{row.meanGapDraws?.toFixed(1) ?? '—'}</Text>
          <Text style={[styles.gapDate, styles.gapText, { color: colors.textMuted }]}>{row.lastSeen ? shortDate(row.lastSeen) : '—'}</Text>
        </View>
      ))}
    </>
  );
}

export function ParityDonutChart({ analysis }: { analysis: GameAnalysis }) {
  const { colors } = useAppTheme();
  const data: pieDataItem[] = [
    {
      value: analysis.summary.evenOccurrences,
      color: colors.primary,
      text: `${analysis.summary.evenOccurrencePct.toFixed(0)}%`,
      textColor: palette.white,
    },
    {
      value: analysis.summary.oddOccurrences,
      color: palette.gold500,
      text: `${analysis.summary.oddOccurrencePct.toFixed(0)}%`,
      textColor: palette.navy950,
    },
  ];

  return (
    <>
      <View
        accessible
        accessibilityLabel={`Donut chart. ${analysis.summary.evenOccurrences} even values, ${analysis.summary.evenOccurrencePct.toFixed(0)} percent. ${analysis.summary.oddOccurrences} odd values, ${analysis.summary.oddOccurrencePct.toFixed(0)} percent.`}
        accessibilityRole="image"
        style={styles.pieWrap}>
        <PieChart
          centerLabelComponent={() => (
            <View style={styles.pieCenter}>
              <Text style={[styles.pieTotal, { color: colors.text }]}>{analysis.summary.numberObservations}</Text>
              <Text style={[styles.pieCenterLabel, { color: colors.textMuted }]}>values</Text>
            </View>
          )}
          data={data}
          donut
          innerCircleColor={colors.surface}
          innerRadius={51}
          radius={82}
          showText
          strokeColor={colors.surface}
          strokeWidth={2}
          textSize={10}
        />
      </View>
      <ChartLegend
        items={[
          { label: 'Even', color: colors.primary, detail: `${analysis.summary.evenOccurrences} · ${analysis.summary.evenOccurrencePct.toFixed(0)}%` },
          { label: 'Odd', color: palette.gold500, detail: `${analysis.summary.oddOccurrences} · ${analysis.summary.oddOccurrencePct.toFixed(0)}%` },
        ]}
      />
    </>
  );
}

export function LowHighDistributionChart({ analysis }: { analysis: GameAnalysis }) {
  const { colors } = useAppTheme();
  const rows = [...analysis.lowHighDistribution].sort(
    (left, right) => left.lowCount - right.lowCount,
  );
  const data: barDataItem[] = rows.map((row) => ({
    value: row.observedPct,
    label: `${row.lowCount}L/${row.highCount}H`,
    labelTextStyle: {
      ...chartTextStyle(colors.textMuted),
      lineHeight: 12,
      textAlign: 'center',
    },
    frontColor: row.lowCount >= row.highCount ? colors.primary : palette.coral600,
    topLabelComponent: () => (
      <Text style={[styles.chartValue, { color: colors.text }]}>{row.observedPct.toFixed(0)}%</Text>
    ),
  }));

  return (
    <>
      <ChartFrame
        accessibilityLabel={`Bar chart of low and high number combinations. ${rows.map((row) => `${row.lowCount} low and ${row.highCount} high, ${row.drawCount} draws`).join('. ')}`}
        height={240}>
        {(width) => (
          <BarChart
            backgroundColor="transparent"
            barBorderRadius={5}
            barWidth={20}
            data={data}
            disableForeignObject
            disablePress
            endSpacing={16}
            height={180}
            hideRules
            initialSpacing={12}
            maxValue={100}
            nestedScrollEnabled
            noOfSections={4}
            overflowTop={14}
            roundedTop
            rulesColor={colors.border}
            showScrollIndicator
            showValuesAsTopLabel
            spacing={34}
            width={chartPlotWidth(width)}
            xAxisLabelsHeight={30}
            xAxisLabelsVerticalShift={8}
            xAxisLabelTextStyle={chartTextStyle(colors.textMuted)}
            xAxisTextNumberOfLines={1}
            xAxisThickness={0}
            yAxisColor={colors.border}
            yAxisLabelSuffix="%"
            yAxisTextStyle={chartTextStyle(colors.textMuted)}
          />
        )}
      </ChartFrame>
      <ScrollHint />
    </>
  );
}

export function DrawTotalsAreaChart({ analysis }: { analysis: GameAnalysis }) {
  const { colors } = useAppTheme();
  const features = analysis.drawFeatures;
  const totals = features.map((feature) => feature.sum);
  const minimum = Math.min(...totals);
  const maximum = Math.max(...totals);
  const span = Math.max(1, maximum - minimum);
  const offset = Math.max(0, Math.floor(minimum - span * 0.2));
  const chartMaximum = Math.max(1, Math.ceil(maximum - offset + span * 0.15));
  const data: lineDataItem[] = features.map((feature) => ({
    value: feature.sum,
    label: shortDate(feature.date),
    dataPointText: String(feature.sum),
    textShiftX: -9,
    textShiftY: -14,
  }));

  return (
    <>
      <ChartFrame
        accessibilityLabel={`Area chart of draw totals. ${features.map((feature) => `${shortDate(feature.date)}, ${feature.sum}`).join('. ')}`}
        height={250}>
        {(width) => (
          <LineChart
            areaChart
            backgroundColor="transparent"
            color={colors.primary}
            data={data}
            dataPointsColor={palette.coral600}
            dataPointsRadius={4}
            disableForeignObject
            endFillColor={colors.surface}
            endSpacing={20}
            endOpacity={0.04}
            height={190}
            hideRules
            initialSpacing={12}
            maxValue={chartMaximum}
            noOfSections={4}
            nestedScrollEnabled
            overflowTop={24}
            rulesColor={colors.border}
            showScrollIndicator
            showValuesAsDataPointsText
            spacing={64}
            startFillColor={colors.primary}
            startOpacity={0.28}
            textColor={colors.text}
            textFontSize={8}
            thickness={3}
            width={chartPlotWidth(width)}
            xAxisColor={colors.border}
            xAxisLabelsHeight={28}
            xAxisLabelTextStyle={chartTextStyle(colors.textMuted)}
            yAxisColor={colors.border}
            yAxisOffset={offset}
            yAxisTextStyle={chartTextStyle(colors.textMuted)}
          />
        )}
      </ChartFrame>
      <ScrollHint />
      <Text style={[styles.caption, { color: colors.textMuted }]}>Minimum {minimum} · Average {analysis.sumStatistics.average?.toFixed(1) ?? '—'} · Maximum {maximum}</Text>
    </>
  );
}

export function PositionFrequencyChart({ analysis }: { analysis: GameAnalysis }) {
  const { colors } = useAppTheme();
  const values = Array.from(
    { length: analysis.rule.maximum - analysis.rule.minimum + 1 },
    (_, index) => analysis.rule.minimum + index,
  );
  const dataSet: DataSet[] = Array.from({ length: analysis.rule.pickCount }, (_, index) => {
    const position = index + 1;
    const byNumber = new Map(
      analysis.positionFrequency
        .filter((row) => row.position === position)
        .map((row) => [row.numericValue, row.count]),
    );
    return {
      data: values.map((value, valueIndex) => ({
        value: byNumber.get(value) ?? 0,
        label: index === 0 && (values.length <= 12 || valueIndex % 5 === 0 || valueIndex === values.length - 1)
          ? String(value).padStart(analysis.rule.displayWidth, '0')
          : '',
      })),
      color: SERIES_COLORS[index % SERIES_COLORS.length],
      dataPointsColor: SERIES_COLORS[index % SERIES_COLORS.length],
      dataPointsRadius: 2.5,
      thickness: 2,
    };
  });
  const maximum = Math.max(1, ...analysis.positionFrequency.map((row) => row.count));
  const topByPosition = Array.from({ length: analysis.rule.pickCount }, (_, index) => {
    const position = index + 1;
    const rows = analysis.positionFrequency
      .filter((row) => row.position === position)
      .sort((left, right) => right.count - left.count || left.numericValue - right.numericValue);
    const top = rows[0];
    return { position, top };
  });

  return (
    <>
      <ChartLegend
        items={Array.from({ length: analysis.rule.pickCount }, (_, index) => ({
          label: `P${index + 1}`,
          color: SERIES_COLORS[index % SERIES_COLORS.length],
        }))}
      />
      <ChartFrame
        accessibilityLabel={`Multi-line chart showing frequency by position. ${topByPosition.map(({ position, top }) => `Position ${position}: ${top?.number ?? 'none'} appeared ${top?.count ?? 0} times`).join('. ')}`}
        height={245}>
        {(width) => (
          <LineChart
            backgroundColor="transparent"
            dataSet={dataSet}
            disableForeignObject
            focusTogether
            height={190}
            initialSpacing={12}
            maxValue={maximum}
            nestedScrollEnabled
            noOfSections={Math.min(5, maximum)}
            rulesColor={colors.border}
            showScrollIndicator
            spacing={values.length <= 12 ? 40 : 30}
            width={chartPlotWidth(width)}
            xAxisColor={colors.border}
            xAxisLabelsHeight={28}
            xAxisLabelTextStyle={chartTextStyle(colors.textMuted)}
            yAxisColor={colors.border}
            yAxisTextStyle={chartTextStyle(colors.textMuted)}
          />
        )}
      </ChartFrame>
      <ScrollHint />
      <View style={styles.positionSummary}>
        {topByPosition.map(({ position, top }, index) => (
          <View key={position} style={[styles.positionPill, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <View style={[styles.legendSwatch, { backgroundColor: SERIES_COLORS[index % SERIES_COLORS.length] }]} />
            <Text style={[styles.positionText, { color: colors.text }]}>
              P{position}: {top?.number ?? '—'} ({top?.count ?? 0}x)
            </Text>
          </View>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  chartFrame: { width: '100%', overflow: 'hidden', justifyContent: 'center' },
  svgChartShell: { width: '100%', overflow: 'hidden', borderWidth: 1, borderRadius: radius.md },
  svgScrollContent: { minWidth: '100%' },
  scrollHint: { fontSize: 8, lineHeight: 12, fontWeight: '700', textAlign: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { fontSize: 9, lineHeight: 13, fontWeight: '800' },
  caption: { fontSize: 9, lineHeight: 14, textAlign: 'center' },
  miniTitle: { fontSize: 11, lineHeight: 15, fontWeight: '900' },
  changeList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  changePill: { minHeight: 36, paddingHorizontal: 8, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: radius.sm },
  changeNumber: { fontSize: 10, fontWeight: '900' },
  changeValue: { fontSize: 8, fontWeight: '800' },
  chartValue: { minWidth: 24, fontSize: 8, lineHeight: 11, fontWeight: '900', textAlign: 'center' },
  gapHeader: { minHeight: 32, paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center', borderRadius: radius.sm },
  gapHeaderText: { fontSize: 8, lineHeight: 11, fontWeight: '900' },
  gapRow: { minHeight: 36, paddingHorizontal: 5, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  gapNumber: { width: 42 },
  gapMetric: { width: 62, textAlign: 'center' },
  gapDate: { flex: 1, textAlign: 'right' },
  gapText: { fontSize: 9, lineHeight: 13, fontWeight: '700' },
  gapTextStrong: { fontSize: 10, lineHeight: 14, fontWeight: '900' },
  pieWrap: { minHeight: 184, alignItems: 'center', justifyContent: 'center' },
  pieCenter: { alignItems: 'center' },
  pieTotal: { fontSize: 21, lineHeight: 25, fontWeight: '900' },
  pieCenterLabel: { fontSize: 9, lineHeight: 12, fontWeight: '800' },
  positionSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  positionPill: { minHeight: 32, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: radius.pill },
  positionText: { fontSize: 9, lineHeight: 13, fontWeight: '800' },
});
