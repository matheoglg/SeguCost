// M-07 Resumen de turno (RF-24). Effective time + active pauses + rests add up to the total recorded.
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { MCard, MobileScreen, MText, MTitle } from '@/components/mobile/Mobile';
import { stageLabels } from '@/domain/labels';
import { sumBreakdowns, timeBreakdown } from '@/domain/production';
import type { StageType } from '@/domain/types';
import { formatDuration, formatKg, formatNumber, formatTime } from '@/format';
import { useNow } from '@/hooks/useNow';
import { useDataStore } from '@/store/data';
import { stageInfo } from '@/store/selectors';
import { useCurrentUser } from '@/store/session';
import { colors, font, radius, spacing } from '@/theme';

export default function ShiftSummaryScreen() {
  const user = useCurrentUser()!;
  const db = useDataStore((s) => s.db);
  const now = useNow(30_000);
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const since = startOfDay.toISOString();

  const entries = db.timeEntries.filter((t) => t.operatorId === user.id && t.start >= since).sort((a, b) => a.start.localeCompare(b.start));
  const total = sumBreakdowns(entries.map((e) => timeBreakdown(e, now)));
  const records = db.productionRecords.filter((r) => r.operatorId === user.id && r.at >= since);

  const byStage = new Map<StageType, { kg: number; units: number }>();
  for (const r of records) {
    const type = db.stages.find((s) => s.id === r.stageId)!.type;
    const acc = byStage.get(type) ?? { kg: 0, units: 0 };
    byStage.set(type, { kg: acc.kg + (r.rollKg ?? 0), units: acc.units + (r.units ?? 0) });
  }
  for (const e of entries) {
    const stage = db.stages.find((s) => s.id === e.stageId)!;
    if (stage.type === 'packing') {
      const order = db.orders.find((o) => o.id === stage.orderId)!;
      if (order.finalCount && order.packedAt && order.packedAt >= since) byStage.set('packing', { kg: 0, units: (byStage.get('packing')?.units ?? 0) + order.finalCount });
    }
  }

  const tiles = [
    { label: 'Tiempo efectivo', value: total.effectiveMs, color: colors.primary },
    { label: 'Pausas activas', value: total.activePauseMs, color: colors.activePause },
    { label: 'Descansos', value: total.restMs, color: colors.rest },
  ];

  return (
    <MobileScreen footer={<Button title="Volver a mis órdenes" size="lg" onPress={() => router.replace('/m/ordenes')} testID="back-orders" />}>
      <View>
        <MTitle>{user.name}</MTitle>
        <MText muted>{user.shift}</MText>
      </View>

      <View style={styles.tiles}>
        {tiles.map((t) => (
          <View key={t.label} style={[styles.tile, { borderTopColor: t.color }]}>
            <Text style={styles.tileLabel}>{t.label}</Text>
            <Text style={styles.tileValue}>{formatDuration(t.value)}</Text>
          </View>
        ))}
      </View>
      <MText muted>Tiempo total registrado: {formatDuration(total.totalMs)}</MText>

      <MCard>
        <MTitle>Producción registrada</MTitle>
        {byStage.size === 0 && <MText muted>Aún no registra producción hoy.</MText>}
        {[...byStage.entries()].map(([type, v]) => (
          <View key={type} style={styles.line}>
            <MText>{stageLabels[type]}</MText>
            <MText bold>{type === 'extrusion' ? `${formatKg(v.kg)} de rollo` : `${formatNumber(v.units)} u`}</MText>
          </View>
        ))}
      </MCard>

      <MCard>
        <MTitle>Operaciones del día</MTitle>
        {entries.length === 0 && <MText muted>Sin operaciones registradas hoy.</MText>}
        {entries.map((e) => {
          const info = stageInfo(db, e.stageId)!;
          const t = timeBreakdown(e, now);
          return (
            <View key={e.id} style={styles.op}>
              <View style={styles.line}>
                <MText bold>
                  {info.order.code} · {stageLabels[info.stage.type]}
                </MText>
                <MText muted>{info.machine?.code ?? 'Manual'}</MText>
              </View>
              <MText muted>
                {formatTime(e.start)} – {e.end ? formatTime(e.end) : 'en curso'} · {formatDuration(t.effectiveMs)} efectivos
              </MText>
            </View>
          );
        })}
      </MCard>
    </MobileScreen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: { flex: 1, backgroundColor: colors.background, borderRadius: radius.md, borderTopWidth: 5, padding: spacing.md, gap: spacing.xs },
  tileLabel: { fontSize: font.size.md, color: colors.textMuted },
  tileValue: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.text },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  op: { gap: 2, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.surface },
});
