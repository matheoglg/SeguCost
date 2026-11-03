// M-08 Planta (supervisor) (RF-25, RF-17). Machine states and waste alerts on the phone.
import { router, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { MachineStateBadge, machineStateView } from '@/components/MachineState';
import { MCard, MobileScreen, MText } from '@/components/mobile/Mobile';
import { OrderStatusBadge } from '@/components/StatusBadge';
import { sectionLabels, stageLabels } from '@/domain/labels';
import { machineStatus, orderWaste } from '@/domain/production';
import { formatElapsed, formatPercent, formatTime } from '@/format';
import { useNow } from '@/hooks/useNow';
import { useDataStore } from '@/store/data';
import { orderInfo, stageInfo, userName } from '@/store/selectors';
import { colors, font, spacing } from '@/theme';

export default function MobilePlantScreen() {
  const db = useDataStore((s) => s.db);
  const now = useNow(5000);
  const active = db.orders.filter((o) => o.status === 'inProgress' || o.status === 'toValidate');
  const alerts = active.map((o) => ({ order: o, waste: orderWaste(db, o.id) })).filter((a) => a.waste.alert);
  const toValidate = db.orders.filter((o) => o.status === 'toValidate');
  const open = (orderId: string) => router.push(`/m/ordenes/${orderId}` as Href);

  return (
    <MobileScreen>
      <Text style={styles.updated}>Actualizado {formatTime(now.toISOString())}</Text>

      {alerts.map(({ order, waste }) => (
        <MCard key={order.id} accent={colors.alert} onPress={() => open(order.id)} testID={`alert-${order.id}`}>
          <View style={styles.row}>
            <Icon name="alert" color={colors.alert} size={24} />
            <Text style={styles.alertTitle}>Merma excedida · {order.code}</Text>
          </View>
          <MText>
            {formatPercent(waste.fraction)} sobre la materia prima usada (máximo {formatPercent(db.settings.maxWastePct, 0)})
          </MText>
        </MCard>
      ))}

      <Text style={styles.section}>Máquinas</Text>
      {db.machines.map((m) => {
        const status = machineStatus(db, m.id);
        const view = machineStateView(status);
        const info = status.entry && stageInfo(db, status.entry.stageId);
        return (
          <MCard key={m.id} accent={view.color} onPress={info ? () => open(info.order.id) : undefined} testID={`machine-${m.code}`}>
            <View style={styles.row}>
              <Text style={styles.code}>{m.code}</Text>
              <MText muted>{sectionLabels[m.section]}</MText>
            </View>
            <MachineStateBadge status={status} large />
            {info ? (
              <MText>
                {userName(db, status.entry!.operatorId)} · {info.order.code} {stageLabels[info.stage.type]}
              </MText>
            ) : null}
            {status.since && <MText muted>Hace {formatElapsed(now.getTime() - new Date(status.since).getTime())} en este estado</MText>}
          </MCard>
        );
      })}

      <Text style={styles.section}>Órdenes por validar ({toValidate.length})</Text>
      {toValidate.map((o) => {
        const info = orderInfo(db, o.id)!;
        return (
          <MCard key={o.id} onPress={() => open(o.id)}>
            <View style={styles.row}>
              <Text style={styles.code}>{o.code}</Text>
              <OrderStatusBadge status={o.status} />
            </View>
            <MText>
              {info.product.code} · {info.customer.name}
            </MText>
          </MCard>
        );
      })}
    </MobileScreen>
  );
}

const styles = StyleSheet.create({
  updated: { fontSize: font.size.md, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  alertTitle: { flex: 1, fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.alert },
  section: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.text, marginTop: spacing.sm },
  code: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.primary },
});
