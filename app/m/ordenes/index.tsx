// M-01 Mis órdenes (RF-14, RF-03). Stages assigned to the operator, by delivery date.
import { router, type Href } from 'expo-router';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { MCard, MInfo, MInfoGrid, MobileScreen, MText } from '@/components/mobile/Mobile';
import { showToast } from '@/components/Toast';
import { stageLabels } from '@/domain/labels';
import { openPause, timeBreakdown } from '@/domain/production';
import { formatDate, formatKg, formatNumber, formatTimer } from '@/format';
import { useNow } from '@/hooks/useNow';
import { markNotificationsRead } from '@/store/actions';
import { useDataStore } from '@/store/data';
import { operatorStages, runningEntry, stageGoal, stageInfo } from '@/store/selectors';
import { useCurrentUser } from '@/store/session';
import { useUiStore } from '@/store/ui';
import { colors, font, radius, spacing } from '@/theme';

export default function MyOrdersScreen() {
  const user = useCurrentUser()!;
  const db = useDataStore((s) => s.db);
  const offline = useUiStore((s) => s.offline);
  const setOffline = useUiStore((s) => s.setOffline);
  const now = useNow();

  const running = runningEntry(db, user.id);
  const runningInfo = running && stageInfo(db, running.stageId);
  const stages = operatorStages(db, user.id).filter((i) => i.stage.id !== running?.stageId);
  const notices = db.notifications.filter((n) => n.userId === user.id && !n.read);
  const firstName = user.name.split(' ')[0];

  const toggleOffline = (value: boolean) => {
    const synced = setOffline(value);
    if (!value && synced) showToast('success', `Señal recuperada: ${synced} marcación${synced === 1 ? '' : 'es'} sincronizada${synced === 1 ? '' : 's'}`);
  };

  return (
    <MobileScreen>
      <View style={styles.greeting}>
        <Text style={styles.hello}>Hola, {firstName}</Text>
        <Text style={styles.shift}>{user.shift ?? 'Turno sin asignar'}</Text>
      </View>

      <View style={styles.switchRow}>
        <Icon name="wifiOff" color={colors.textMuted} size={22} />
        <Text style={styles.switchLabel}>Simular sin conexión</Text>
        <Switch value={offline} onValueChange={toggleOffline} testID="offline-switch" accessibilityLabel="Simular sin conexión" trackColor={{ true: colors.warning, false: colors.border }} />
      </View>

      {notices.map((n) => (
        <MCard key={n.id} accent={colors.alert}>
          <MText bold>Aviso del supervisor</MText>
          <MText>{n.message}</MText>
          <Button title="Entendido" variant="secondary" onPress={() => markNotificationsRead(user.id)} />
        </MCard>
      ))}

      {running && runningInfo && (
        <MCard testID="running-operation" accent={openPause(running) ? colors.rest : colors.success} onPress={() => router.push('/m/operacion')}>
          <View style={styles.runningHead}>
            <Icon name="clock" color={openPause(running) ? colors.rest : colors.success} size={24} />
            <Text style={[styles.runningTitle, { color: openPause(running) ? colors.rest : colors.success }]}>
              {openPause(running) ? 'Operación en pausa' : 'Operación en curso'}
            </Text>
            <Text style={styles.runningTimer}>{formatTimer(timeBreakdown(running, now).effectiveMs)}</Text>
          </View>
          <MText bold size="lg">
            {runningInfo.order.code} · {stageLabels[runningInfo.stage.type]}
          </MText>
          <MText muted>Toque para continuar</MText>
        </MCard>
      )}

      <Text style={styles.section}>Etapas asignadas ({stages.length})</Text>
      {stages.length === 0 && <MText muted>No tiene etapas pendientes.</MText>}
      {stages.map((info) => {
        const goal = stageGoal(db, info.stage);
        return (
          <MCard key={info.stage.id} testID={`stage-${info.stage.id}`} onPress={() => router.push(`/m/etapas/${info.stage.id}` as Href)}>
            <View style={styles.cardHead}>
              <Text style={styles.stageName}>{stageLabels[info.stage.type]}</Text>
              <Text style={styles.orderCode}>{info.order.code}</Text>
            </View>
            <MText bold size="lg">
              {info.product.code} · {info.product.name}
            </MText>
            <MInfoGrid>
              <MInfo label="Medidas" value={`${info.product.widthCm} x ${info.product.lengthCm} cm`} />
              <MInfo label="A producir" value={goal.unit === 'kg' ? formatKg(goal.value) : `${formatNumber(goal.value)} u`} />
              <MInfo label="Máquina" value={info.machine?.code ?? 'Manual'} />
              <MInfo label="Entrega" value={formatDate(info.salesOrder.dueDate)} />
            </MInfoGrid>
          </MCard>
        );
      })}

      <Button title="Resumen de turno" icon="clock" variant="secondary" size="lg" onPress={() => router.push('/m/turno')} testID="shift-summary" />
    </MobileScreen>
  );
}

const styles = StyleSheet.create({
  greeting: { gap: 2 },
  hello: { fontSize: font.size.xxl, fontWeight: font.weight.bold, color: colors.primary },
  shift: { fontSize: font.size.md, color: colors.textMuted },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, minHeight: 56 },
  switchLabel: { flex: 1, fontSize: font.size.md, color: colors.text },
  runningHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  runningTitle: { flex: 1, fontSize: font.size.lg, fontWeight: font.weight.bold },
  runningTimer: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.text, fontVariant: ['tabular-nums'] },
  section: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.text, marginTop: spacing.sm },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stageName: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.primary },
  orderCode: { fontSize: font.size.md, fontWeight: font.weight.bold, color: colors.textMuted },
});
