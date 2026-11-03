// Mobile version of W-09 for the supervisor (opened from M-08): progress, waste and closing validation.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { MCard, MInfo, MInfoGrid, MobileScreen, MText, MTitle } from '@/components/mobile/Mobile';
import { OrderStatusBadge } from '@/components/StatusBadge';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { stageLabels, stageStatusLabels } from '@/domain/labels';
import { orderWaste } from '@/domain/production';
import { formatKg, formatNumber, formatPercent } from '@/format';
import { returnOrder, validateOrder } from '@/store/actions';
import { useDataStore } from '@/store/data';
import { orderInfo } from '@/store/selectors';
import { colors, font, spacing } from '@/theme';

export default function MobileOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDataStore((s) => s.db);
  const info = orderInfo(db, id);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');

  if (!info) {
    return (
      <MobileScreen>
        <MText>No se encontró la orden.</MText>
      </MobileScreen>
    );
  }
  const { order, product, customer, salesOrder, stages } = info;
  const waste = orderWaste(db, order.id);

  const validate = () => {
    const r = validateOrder(order.id);
    if (!r.ok) return showToast('error', Object.values(r.errors)[0]);
    showToast('success', `${order.code} cerrada y costeada`);
  };
  const giveBack = () => {
    const r = returnOrder(order.id, note);
    if (!r.ok) return setNoteError(r.errors.note ?? Object.values(r.errors)[0]);
    showToast('success', `${order.code} devuelta al operario`);
    router.back();
  };

  return (
    <MobileScreen>
      <View style={styles.head}>
        <Text style={styles.code}>{order.code}</Text>
        <OrderStatusBadge status={order.status} large />
      </View>
      <MText>
        {product.code} · {product.name} · {customer.name}
      </MText>

      <MCard accent={waste.alert ? colors.alert : colors.success}>
        <MTitle>Merma</MTitle>
        <Text style={[styles.waste, { color: waste.alert ? colors.alert : colors.success }]}>{formatPercent(waste.fraction)}</Text>
        <MText muted>
          {formatKg(waste.wasteKg)} sobre {formatKg(waste.rawKg)} de materia prima · máximo {formatPercent(db.settings.maxWastePct, 0)}
        </MText>
      </MCard>

      <MCard>
        <MTitle>Etapas</MTitle>
        {stages.map((s) => {
          const recs = db.productionRecords.filter((r) => r.stageId === s.id);
          const produced = s.type === 'extrusion' ? formatKg(recs.reduce((t, r) => t + (r.rollKg ?? 0), 0)) : `${formatNumber(recs.reduce((t, r) => t + (r.units ?? 0), 0))} u`;
          return (
            <View key={s.id} style={styles.stage}>
              <MText bold>
                {s.sequence}. {stageLabels[s.type]}
              </MText>
              <MText muted>
                {stageStatusLabels[s.status]}
                {s.type !== 'packing' ? ` · ${produced}` : ''}
              </MText>
            </View>
          );
        })}
      </MCard>

      {order.finalCount !== undefined && (
        <MCard>
          <MTitle>Cierre en empacado</MTitle>
          <MInfoGrid>
            <MInfo label="Pedido" value={`${formatNumber(salesOrder.quantity)} u`} />
            <MInfo label="Contado" value={`${formatNumber(order.finalCount)} u`} />
            <MInfo label="Bultos" value={String(order.bundles)} />
          </MInfoGrid>
        </MCard>
      )}

      {order.status === 'toValidate' && (
        <MCard>
          <Button title="Validar cierre" size="lg" variant="success" onPress={validate} testID="validate" />
          <TextField label="Observación para devolver" value={note} onChangeText={(t) => { setNote(t); setNoteError(''); }} error={noteError} large multiline />
          <Button title="Devolver con observación" size="lg" variant="secondary" onPress={giveBack} />
        </MCard>
      )}
    </MobileScreen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { fontSize: font.size.xxl, fontWeight: font.weight.bold, color: colors.primary },
  waste: { fontSize: 40, fontWeight: font.weight.bold },
  stage: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
});
