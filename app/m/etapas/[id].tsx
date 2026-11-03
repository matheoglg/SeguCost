// M-02 Detalle de etapa (RF-14, RF-21). Information before starting; one timer per operator.
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { MCard, MInfo, MInfoGrid, MobileScreen, MText, MTitle } from '@/components/mobile/Mobile';
import { showToast } from '@/components/Toast';
import { productTypeLabels, stageLabels } from '@/domain/labels';
import { formatDate, formatKg, formatNumber } from '@/format';
import { startOperation } from '@/store/actions';
import { useDataStore } from '@/store/data';
import { runningEntry, stageGoal, stageInfo } from '@/store/selectors';
import { useCurrentUser } from '@/store/session';
import { colors, font, spacing } from '@/theme';

export default function StageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useCurrentUser()!;
  const db = useDataStore((s) => s.db);
  const info = stageInfo(db, id);

  if (!info) {
    return (
      <MobileScreen>
        <MText>No se encontró la etapa.</MText>
      </MobileScreen>
    );
  }

  const { stage, order, product, machine, stages } = info;
  const goal = stageGoal(db, stage);
  const running = runningEntry(db, user.id);
  const mine = stage.operatorIds.includes(user.id);
  const blocked = !!running || !mine || stage.status === 'done';

  const start = () => {
    const result = startOperation(stage.id, user.id);
    if (!result.ok) return showToast('error', Object.values(result.errors)[0]);
    showToast('success', 'Operación iniciada');
    router.replace('/m/operacion');
  };

  return (
    <MobileScreen
      footer={
        <>
          {running && <MText muted>Ya tiene una operación en curso. Finalícela antes de iniciar otra.</MText>}
          <Button title="Iniciar operación" size="lg" variant="success" icon="clock" disabled={blocked} onPress={start} testID="start-operation" />
        </>
      }
    >
      <View style={styles.head}>
        <Text style={styles.stage}>{stageLabels[stage.type]}</Text>
        <MText muted>
          {order.code} · Etapa {stage.sequence} de {stages.length}
        </MText>
      </View>

      <MCard>
        <MTitle>Meta de la etapa</MTitle>
        <Text style={styles.goal}>{goal.unit === 'kg' ? formatKg(goal.value) : `${formatNumber(goal.value)} unidades`}</Text>
        <MText muted>Máquina asignada</MText>
        <Text style={styles.machine}>{machine ? `${machine.code}` : 'Empacado manual'}</Text>
      </MCard>

      <MCard>
        <MTitle>Funda</MTitle>
        <MText bold size="lg">
          {product.code} · {product.name}
        </MText>
        <MInfoGrid>
          <MInfo label="Medidas" value={`${product.widthCm} x ${product.lengthCm} cm`} />
          <MInfo label="Calibre" value={formatNumber(product.gauge, 1)} />
          <MInfo label="Tipo" value={productTypeLabels[product.type]} />
          <MInfo label="Peso por unidad" value={`${formatNumber(product.weightG, 1)} g`} />
          <MInfo label="Entrega" value={formatDate(info.salesOrder.dueDate)} />
        </MInfoGrid>
      </MCard>

      <MCard>
        <MTitle>Ruta de la orden</MTitle>
        {stages.map((s) => (
          <View key={s.id} style={styles.step}>
            <View style={[styles.stepDot, s.status === 'done' && styles.stepDone, s.id === stage.id && styles.stepCurrent]}>
              <Text style={[styles.stepNum, (s.status === 'done' || s.id === stage.id) && styles.stepNumOn]}>{s.sequence}</Text>
            </View>
            <Text style={[styles.stepText, s.id === stage.id && styles.stepTextOn]}>
              {stageLabels[s.type]}
              {s.status === 'done' ? ' · terminada' : s.status === 'inProgress' ? ' · en proceso' : ''}
            </Text>
          </View>
        ))}
      </MCard>
    </MobileScreen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xs },
  stage: { fontSize: font.size.xxl, fontWeight: font.weight.bold, color: colors.primary },
  goal: { fontSize: 40, fontWeight: font.weight.bold, color: colors.text, fontVariant: ['tabular-nums'] },
  machine: { fontSize: font.size.xxl, fontWeight: font.weight.bold, color: colors.primary },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 40 },
  stepDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepDone: { backgroundColor: colors.success, borderColor: colors.success },
  stepCurrent: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepNum: { fontSize: font.size.md, fontWeight: font.weight.bold, color: colors.textMuted },
  stepNumOn: { color: colors.onPrimary },
  stepText: { fontSize: font.size.md, color: colors.text },
  stepTextOn: { fontWeight: font.weight.bold, color: colors.primary },
});
