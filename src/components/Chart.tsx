// Line and bar charts drawn with react-native-svg (web and Android).
// Thin marks, recessive grid, legend for 2+ series, direct end labels on lines, and a per-category
// hover/focus tooltip whose hit area is the whole column. Values stay reachable in each screen's table.
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Polyline, Text as SvgText } from 'react-native-svg';

import { chartColors, colors, font, radius, spacing } from '@/theme';

export interface Series {
  name: string;
  values: (number | null)[];
  color?: string;
}

interface ChartProps {
  categories: string[];
  series: Series[];
  formatValue: (n: number) => string;
  height?: number;
  title?: string;
  testID?: string;
}

const PAD = { top: 16, right: 16, bottom: 28, left: 64 };
// SVG text does not inherit the page font on the web.
const SVG_FONT = Platform.OS === 'web' ? 'Segoe UI, Roboto, Helvetica, Arial, sans-serif' : undefined;

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Number(v.toPrecision(10)));
  return ticks;
}

function useWidth(initial = 600) {
  const [width, setWidth] = useState(initial);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.max(240, e.nativeEvent.layout.width));
  return { width, onLayout };
}

const colorOf = (s: Series, i: number) => s.color ?? chartColors[i % chartColors.length];

function Legend({ series, kind }: { series: Series[]; kind: 'line' | 'bar' }) {
  if (series.length < 2) return null;
  return (
    <View style={styles.legend}>
      {series.map((s, i) => (
        <View key={s.name} style={styles.legendItem}>
          <View style={kind === 'line' ? [styles.legendLine, { backgroundColor: colorOf(s, i) }] : [styles.legendBox, { backgroundColor: colorOf(s, i) }]} />
          <Text style={styles.legendText}>{s.name}</Text>
        </View>
      ))}
    </View>
  );
}

function Tooltip({ title, rows, x, width }: { title: string; rows: { name: string; value: string; color: string }[]; x: number; width: number }) {
  const w = 200;
  const left = Math.min(Math.max(0, x - w / 2), width - w);
  return (
    <View style={[styles.tooltip, { left, width: w }]} pointerEvents="none">
      <Text style={styles.tooltipTitle}>{title}</Text>
      {rows.map((r) => (
        <View key={r.name} style={styles.tooltipRow}>
          <View style={[styles.tooltipKey, { backgroundColor: r.color }]} />
          <Text style={styles.tooltipValue}>{r.value}</Text>
          <Text style={styles.tooltipName} numberOfLines={1}>
            {r.name}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Transparent columns over the plot: hover or focus shows the tooltip for that category. */
function HitColumns({ count, x0, step, height, onHover }: { count: number; x0: number; step: number; height: number; onHover: (i: number | null) => void }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Pressable
          key={i}
          accessibilityRole="button"
          onHoverIn={() => onHover(i)}
          onHoverOut={() => onHover(null)}
          onFocus={() => onHover(i)}
          onBlur={() => onHover(null)}
          onPressIn={() => onHover(i)}
          style={{ position: 'absolute', top: PAD.top, height, left: x0 + i * step - step / 2, width: step }}
        />
      ))}
    </>
  );
}

export function LineChart({ categories, series, formatValue, height = 240, title, testID }: ChartProps) {
  const { width, onLayout } = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const values = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.abs(max) || 1;
  const ticks = niceTicks(min - span * 0.1, max + span * 0.1);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const labelSpace = series.length > 1 ? 72 : 0;
  const plotW = width - PAD.left - PAD.right - labelSpace;
  const plotH = height - PAD.top - PAD.bottom;
  const step = categories.length > 1 ? plotW / (categories.length - 1) : plotW;
  const x = (i: number) => PAD.left + (categories.length > 1 ? i * step : plotW / 2);
  const y = (v: number) => PAD.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  // Direct end labels, nudged apart so they never overlap (min 14 px).
  const ends = series
    .map((s, i) => {
      const last = [...s.values].reverse().find((v) => v !== null);
      return last == null ? null : { name: s.name, color: colorOf(s, i), y: y(last) };
    })
    .filter((e): e is { name: string; color: string; y: number } => e !== null)
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 14);

  return (
    <View testID={testID} accessibilityLabel={title}>
      <Legend series={series} kind="line" />
      <View onLayout={onLayout} style={{ height }}>
        <Svg width={width} height={height}>
          {ticks.map((t) => (
            <Line key={t} x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} stroke={colors.surface} strokeWidth={1} />
          ))}
          {ticks.map((t) => (
            <SvgText fontFamily={SVG_FONT} key={`l${t}`} x={PAD.left - 8} y={y(t) + 4} fontSize={11} fill={colors.textMuted} textAnchor="end">
              {formatValue(t)}
            </SvgText>
          ))}
          {categories.map((c, i) => (
            <SvgText fontFamily={SVG_FONT} key={c} x={x(i)} y={height - 8} fontSize={11} fill={colors.textMuted} textAnchor="middle">
              {c}
            </SvgText>
          ))}
          {hover !== null && <Line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke={colors.border} strokeWidth={1} />}
          {series.map((s, si) => (
            <Polyline
              key={s.name}
              points={s.values.map((v, i) => (v === null ? null : `${x(i)},${y(v)}`)).filter(Boolean).join(' ')}
              fill="none"
              stroke={colorOf(s, si)}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {series.map((s, si) =>
            s.values.map((v, i) =>
              v === null ? null : (
                <Circle key={`${s.name}${i}`} cx={x(i)} cy={y(v)} r={hover === i ? 5 : 4} fill={colorOf(s, si)} stroke={colors.background} strokeWidth={2} />
              ),
            ),
          )}
          {labelSpace > 0 &&
            ends.map((e) => (
              <SvgText fontFamily={SVG_FONT} key={e.name} x={PAD.left + plotW + 10} y={e.y + 4} fontSize={11} fill={colors.text} fontWeight="bold">
                {e.name.length > 10 ? `${e.name.slice(0, 9)}…` : e.name}
              </SvgText>
            ))}
        </Svg>
        <HitColumns count={categories.length} x0={PAD.left} step={step} height={plotH} onHover={setHover} />
        {hover !== null && (
          <Tooltip
            title={categories[hover]}
            x={x(hover)}
            width={width}
            rows={series.filter((s) => s.values[hover] != null).map((s) => ({ name: s.name, value: formatValue(s.values[hover]!), color: colorOf(s, series.indexOf(s)) }))}
          />
        )}
      </View>
    </View>
  );
}

export function BarChart({ categories, series, formatValue, height = 260, stacked = false, title, testID }: ChartProps & { stacked?: boolean }) {
  const { width, onLayout } = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const totals = categories.map((_, i) => series.reduce((t, s) => t + (s.values[i] ?? 0), 0));
  const maxValue = stacked ? Math.max(...totals) : Math.max(...series.flatMap((s) => s.values.map((v) => v ?? 0)));
  const ticks = niceTicks(0, maxValue || 1);
  const yMax = ticks[ticks.length - 1];
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const step = plotW / Math.max(1, categories.length);
  const groupW = Math.min(step * 0.6, stacked ? 56 : 28 * series.length);
  const y = (v: number) => PAD.top + plotH - (v / yMax) * plotH;
  const GAP = 2;

  /** Bar with 4 px rounded data end, anchored square to the baseline. */
  const bar = (x0: number, w: number, top: number, bottom: number, roundTop: boolean) => {
    const h = Math.max(0, bottom - top);
    const r = roundTop ? Math.min(4, h, w / 2) : 0;
    return `M${x0},${bottom} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + w - r} Q${x0 + w},${top} ${x0 + w},${top + r} V${bottom} Z`;
  };

  return (
    <View testID={testID} accessibilityLabel={title}>
      <Legend series={series} kind="bar" />
      <View onLayout={onLayout} style={{ height }}>
        <Svg width={width} height={height}>
          {ticks.map((t) => (
            <Line key={t} x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} stroke={colors.surface} strokeWidth={1} />
          ))}
          {ticks.map((t) => (
            <SvgText fontFamily={SVG_FONT} key={`l${t}`} x={PAD.left - 8} y={y(t) + 4} fontSize={11} fill={colors.textMuted} textAnchor="end">
              {formatValue(t)}
            </SvgText>
          ))}
          {categories.map((c, i) => {
            const cx = PAD.left + step * i + step / 2;
            const left = cx - groupW / 2;
            const lastIndex = series.map((s, si) => ((s.values[i] ?? 0) > 0 ? si : -1)).reduce((a, b) => Math.max(a, b), -1);
            let acc = 0;
            return (
              <G key={c}>
                {series.map((s, si) => {
                  const v = s.values[i] ?? 0;
                  if (v <= 0) return null;
                  if (stacked) {
                    const bottom = y(acc) - (acc > 0 ? GAP : 0);
                    acc += v;
                    return <Path key={s.name} d={bar(left, groupW, y(acc), bottom, si === lastIndex)} fill={colorOf(s, si)} opacity={hover === null || hover === i ? 1 : 0.55} />;
                  }
                  const w = (groupW - GAP * (series.length - 1)) / series.length;
                  return <Path key={s.name} d={bar(left + si * (w + GAP), w, y(v), y(0), true)} fill={colorOf(s, si)} opacity={hover === null || hover === i ? 1 : 0.55} />;
                })}
                <SvgText fontFamily={SVG_FONT} x={cx} y={height - 8} fontSize={11} fill={colors.textMuted} textAnchor="middle">
                  {c.length > 16 ? `${c.slice(0, 15)}…` : c}
                </SvgText>
              </G>
            );
          })}
          <Line x1={PAD.left} x2={PAD.left + plotW} y1={y(0)} y2={y(0)} stroke={colors.border} strokeWidth={1} />
        </Svg>
        <HitColumns count={categories.length} x0={PAD.left + step / 2} step={step} height={plotH} onHover={setHover} />
        {hover !== null && (
          <Tooltip
            title={categories[hover]}
            x={PAD.left + step * hover + step / 2}
            width={width}
            rows={series.map((s, si) => ({ name: s.name, value: formatValue(s.values[hover] ?? 0), color: colorOf(s, si) }))}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginBottom: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendLine: { width: 16, height: 3, borderRadius: 2 },
  legendBox: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontSize: font.size.sm, color: colors.text },
  tooltip: {
    position: 'absolute',
    top: 0,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  tooltipTitle: { fontSize: 12, color: colors.textMuted, fontWeight: font.weight.bold },
  tooltipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tooltipKey: { width: 12, height: 3, borderRadius: 2 },
  tooltipValue: { fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.text, fontVariant: ['tabular-nums'] },
  tooltipName: { fontSize: 12, color: colors.textMuted, flexShrink: 1 },
});
