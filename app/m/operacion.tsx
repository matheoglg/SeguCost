// M-03 Operación en curso (RF-21, RF-23). Effective-time stopwatch always visible; active pause
// (green) and rest (blue) stop productive time and are counted apart.
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { MCard, MobileScreen, MText } from '@/components/mobile/Mobile';
import { showToast } from '@/components/Toast';
import { pauseTypeLabels, stageLabels } from '@/domain/labels';
import { openPause, timeBreakdown } from '@/domain/production';
import { formatDuration, formatKg, formatNumber, formatTimer } from '@/format';
import { useNow } from '@/hooks/useNow';
import { finishOperation, pauseOperation, resumeOperation } from '@/store/actions';
import { useDataStore } from '@/store/data';
import { runningEntry, stageInfo } from '@/store/selectors';
import { useCurrentUser } from '@/store/session';
import { colors, font, radius, spacing } from '@/theme';

export default function OperationScreen() {
  const user = useCurrentUser()!;
  const db = useDataStore((s) => s.db);
  const now = useNow();
  const entry = runningEntry(db, user.id);

  if (!entry) {
    return (
      <MobileScreen footer={<Button title="Ir a mis órdenes" size="lg" onPress={() => router.replace('/m/ordenes')} />}>
        <MText size="lg">No tiene una operación en curso.</MText>
      </MobileScreen>
    );
  }

  const info = stageInfo(db, entry.stageId)!;
  const pause = openPause(entry);
  const time = timeBreakdown(entry, now);
  const records = db.productionRecords.filter((r) => r.stageId === entry.stageId && r.operatorId === user.id && r.at >= entry.start);
  const wastes = db.wasteRecords.filter((w) => w.stageId === entry.stageId && w.operatorId === user.id && w.at >= entry.start);
  const isExtrusion = info.stage.type === 'extrusion';
  const produced = isExtrusion ? records.reduce((t, r) => t + (r.rollKg ?? 0), 0) : records.reduce((t, r) => t + (r.units ?? 0), 0);
  const wasteKg = wastes.reduce((t, w) => t + w.kg, 0);

  const finish = () => {
    if (info.stage.type === 'packing') return router.push('/m/cierre');
    finishOperation(entry.id);
    showToast('success', `${stageLabels[info.stage.type]} finalizada: ${formatDuration(time.effectiveMs)} efectivos`);
    router.replace('/m/ordenes');
  };

  const pauseColor = pause?.type === 'rest' ? colors.rest : colors.activePause;

  return (
    <MobileScreen
      footer={
        pause ? (
          <Button title="Reanudar" size="lg" onPress={() => resumeOperation(entry.id)} testID="resume" />
        ) : (
          <View style={styles.pauseRow}>
            <View style={styles.flex}>
              <Button title="Pausa activa" size="lg" variant="success" onPress={() => pauseOperation(entry.id, 'active')} testID="active-pause" fullWidth />
            </View>
            <View style={styles.flex}>
              <Button title="Descanso" size="lg" variant="rest" onPress={() => pauseOperation(entry.id, 'rest')} testID="rest" fullWidth />
            </View>
          </View>
        )
      }
    >
      <View style={styles.head}>
        <Text style={styles.stage}>
          {stageLabels[info.stage.type]} · {info.machine?.code ?? 'Manual'}
        </Text>
        <MText muted>
          {info.order.code} · {info.product.code} {info.product.name}
        </MText>
      </View>

      <View style={[styles.timerBox, pause && { borderColor: pauseColor }]} testID="timer">
        <Text style={styles.timerLabel}>Tiempo efectivo</Text>
        <Text style={[styles.timer, pause && styles.timerStopped]} accessibilityLiveRegion="polite">
          {formatTimer(time.effectiveMs)}
        </Text>
        {pause ? (
          <View style={[styles.pauseBanner, { backgroundColor: pauseColor }]}>
            <Text style={styles.pauseText}>{pauseTypeLabels[pause.type]}</Text>
            <Text style={styles.pauseTimer}>{formatTimer(now.getTime() - new Date(pause.start).getTime())}</Text>
          </View>
        ) : (
          <Text style={styles.running}>En marcha</Text>
        )}
        <View style={styles.totals}>
          <Text style={styles.totalItem}>
            <Text style={{ color: colors.activePause }}>■</Text> Pausas activas {formatDuration(time.activePauseMs)}
          </Text>
          <Text style={styles.totalItem}>
            <Text style={{ color: colors.rest }}>■</Text> Descansos {formatDuration(time.restMs)}
          </Text>
        </View>
      </View>

      <MCard>
        <View style={styles.recordRow}>
          <View style={styles.flex}>
            <MText muted>{isExtrusion ? 'Rollo registrado' : 'Unidades registradas'}</MText>
            <MText bold size="xl">
              {isExtrusion ? formatKg(produced) : formatNumber(produced)}
            </MText>
          </View>
          <View style={styles.flex}>
            <MText muted>Merma registrada</MText>
            <MText bold size="xl">
              {formatKg(wasteKg)}
            </MText>
          </View>
        </View>
        <Button title="Registrar producción" size="lg" variant="secondary" onPress={() => router.push('/m/produccion')} testID="go-production" />
        {info.stage.type !== 'packing' && <Button title="Registrar merma" size="lg" variant="secondary" onPress={() => router.push('/m/merma')} testID="go-waste" />}
        <Button title={info.stage.type === 'packing' ? 'Finalizar y cerrar orden' : 'Finalizar'} size="lg" variant="danger" onPress={finish} testID="finish" />
      </MCard>
    </MobileScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { gap: spacing.xs },
  stage: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.primary },
  timerBox: { backgroundColor: colors.background, borderRadius: radius.lg, borderWidth: 3, borderColor: colors.success, padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  timerLabel: { fontSize: font.size.lg, color: colors.textMuted, fontWeight: font.weight.bold },
  timer: { fontSize: font.size.timer, fontWeight: font.weight.bold, color: colors.text, fontVariant: ['tabular-nums'] },
  timerStopped: { color: colors.textMuted },
  running: { fontSize: font.size.lg, color: colors.success, fontWeight: font.weight.bold },
  pauseBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  pauseText: { fontSize: font.size.lg, color: colors.onPrimary, fontWeight: font.weight.bold },
  pauseTimer: { fontSize: font.size.xl, color: colors.onPrimary, fontWeight: font.weight.bold, fontVariant: ['tabular-nums'] },
  totals: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: spacing.lg },
  totalItem: { fontSize: font.size.md, color: colors.text },
  pauseRow: { flexDirection: 'row', gap: spacing.md },
  recordRow: { flexDirection: 'row', gap: spacing.md },
});
