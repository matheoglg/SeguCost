// W-14 Costeo de orden (RF-31, RF-32, RF-33, RF-35). Snapshot computed when the order was validated.
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { SelectField } from '@/components/Inputs';
import { DataTable } from '@/components/web/DataTable';
import { KpiCard } from '@/components/web/KpiCard';
import { Card, Col, Note, Page, Row } from '@/components/web/Page';
import { materialUnitLabels, wasteDestinationLabels } from '@/domain/labels';
import type { OrderCostLine, WasteDestination } from '@/domain/types';
import { formatDateTime, formatKg, formatMoney, formatNumber, formatUnitCost } from '@/format';
import { go } from '@/navigation/go';
import { useDataStore } from '@/store/data';
import { machineCode, orderInfo, userName } from '@/store/selectors';
import { useUiStore } from '@/store/ui';
import { colors, font, radius, spacing } from '@/theme';

const hours = (h: number) => `${formatNumber(h, 2)} h`;

export default function OrderCostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDataStore((s) => s.db);
  const setPreset = useUiStore((s) => s.setSimulatorPreset);
  const closed = db.orders.filter((o) => o.status === 'closed').sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''));
  const info = orderInfo(db, id);
  const cost = db.orderCosts.find((c) => c.orderId === id);

  const selector = (
    <SelectField
      label="Orden cerrada"
      value={cost ? id : undefined}
      onChange={(v) => go(`/costos/ordenes/${v}`)}
      options={closed.map((o) => {
        const i = orderInfo(db, o.id)!;
        return { value: o.id, label: `${o.code} · ${i.product.code} · ${i.customer.name}` };
      })}
      testID="order-select"
    />
  );

  if (!info || !cost) {
    return (
      <Page>
        <View style={{ maxWidth: 480 }}>{selector}</View>
        <Note tone="info">{info ? `${info.order.code} aún no se valida: el costo se calcula al cerrar la orden.` : 'Seleccione una orden cerrada para ver su costeo.'}</Note>
      </Page>
    );
  }

  const lines = (kind: OrderCostLine['kind']) => cost.lines.filter((l) => l.kind === kind);
  const simulate = () => {
    setPreset({ productId: info.product.id, unitCost: cost.unitCost, source: info.order.code });
    go('/precios/simulador');
  };

  return (
    <Page>
      <Row align="flex-end">
        <View style={{ width: 480 }}>{selector}</View>
        <View style={{ flex: 1 }} />
        <Button title="Simular precio" icon="chevronRight" onPress={simulate} testID="simulate-price" />
      </Row>

      <Card>
        <Row align="center">
          <Text style={styles.title}>
            {info.order.code} · {info.product.code} {info.product.name}
          </Text>
          {cost.isService && <Text style={styles.service}>Servicio a terceros</Text>}
        </Row>
        <Text style={styles.muted}>
          {info.customer.name} · {formatNumber(cost.units)} unidades contadas · calculado el {formatDateTime(cost.computedAt)} con los precios y costos vigentes a esa fecha
        </Text>
        {cost.isService && (
          <Note tone="warning">
            El cliente entregó {formatKg(info.salesOrder.receivedMaterialKg ?? 0)} de materia prima: el costo de materiales es 0 y la merma recuperada pertenece al cliente (RF-35).
          </Note>
        )}
      </Card>

      <Row>
        <KpiCard label="Materiales (CM)" value={formatMoney(cost.materials)} />
        <KpiCard label="Mano de obra (CMO)" value={formatMoney(cost.labor)} />
        <KpiCard label="Máquina (CMQ)" value={formatMoney(cost.machine)} />
        <KpiCard label="Merma recuperada (VR)" value={`− ${formatMoney(cost.recovered)}`} tone="success" />
      </Row>
      <Row>
        <View style={[styles.total, { flex: 1 }]}>
          <Text style={styles.totalLabel}>Costo total (CT = CM + CMO + CMQ − VR)</Text>
          <Text style={styles.totalValue} testID="total-cost">
            {formatMoney(cost.total)}
          </Text>
        </View>
        <View style={[styles.total, styles.unit, { flex: 1 }]}>
          <Text style={styles.totalLabel}>Costo unitario (CU = CT / unidades contadas)</Text>
          <Text style={styles.totalValue} testID="unit-cost">
            {formatUnitCost(cost.unitCost)}
          </Text>
        </View>
      </Row>

      <Row>
        <Col minWidth={420}>
          <Card title="Materiales por insumo" padded={false}>
            <DataTable
              rows={lines('material')}
              rowKey={(l) => l.refId}
              emptyText="Sin consumo de materia prima propia."
              columns={[
                { key: 'm', title: 'Insumo', flex: 1.4, render: (l) => { const m = db.materials.find((x) => x.id === l.refId)!; return `${m.code} · ${m.name}`; } },
                { key: 'q', title: 'Consumo', align: 'right', render: (l) => `${formatNumber(l.quantity, 2)} ${materialUnitLabels[db.materials.find((x) => x.id === l.refId)!.unit]}` },
                { key: 'p', title: 'Precio', align: 'right', render: (l) => formatMoney(l.rate) },
                { key: 'a', title: 'Importe', align: 'right', render: (l) => formatMoney(l.amount) },
              ]}
            />
          </Card>
        </Col>
        <Col minWidth={420}>
          <Card title="Mano de obra por operario" padded={false}>
            <DataTable
              rows={lines('labor')}
              rowKey={(l) => `${l.refId}-${l.rate}`}
              columns={[
                { key: 'o', title: 'Operario', flex: 1.4, render: (l) => userName(db, l.refId) },
                { key: 'h', title: 'Horas efectivas', align: 'right', render: (l) => hours(l.quantity) },
                { key: 'r', title: 'Costo hora', align: 'right', render: (l) => formatMoney(l.rate) },
                { key: 'a', title: 'Importe', align: 'right', render: (l) => formatMoney(l.amount) },
              ]}
            />
          </Card>
        </Col>
      </Row>
      <Row>
        <Col minWidth={420}>
          <Card title="Máquinas" padded={false}>
            <DataTable
              rows={lines('machine')}
              rowKey={(l) => `${l.refId}-${l.rate}`}
              columns={[
                { key: 'm', title: 'Máquina', flex: 1.2, render: (l) => machineCode(db, l.refId) },
                { key: 'h', title: 'Horas de operación', align: 'right', render: (l) => hours(l.quantity) },
                { key: 'r', title: 'Costo hora', align: 'right', render: (l) => formatMoney(l.rate) },
                { key: 'a', title: 'Importe', align: 'right', render: (l) => formatMoney(l.amount) },
              ]}
            />
          </Card>
        </Col>
        <Col minWidth={420}>
          <Card title="Merma recuperada" padded={false}>
            <DataTable
              rows={lines('recovery')}
              rowKey={(l) => l.refId}
              emptyText={cost.isService ? 'No aplica a servicios a terceros.' : 'Sin merma recuperada.'}
              columns={[
                { key: 'd', title: 'Destino', flex: 1.2, render: (l) => wasteDestinationLabels[l.refId as WasteDestination] },
                { key: 'k', title: 'Kg', align: 'right', render: (l) => formatKg(l.quantity) },
                { key: 'r', title: 'Valor por kg', align: 'right', render: (l) => formatMoney(l.rate) },
                { key: 'a', title: 'Importe', align: 'right', render: (l) => formatMoney(l.amount) },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </Page>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.primary },
  muted: { fontSize: font.size.sm, color: colors.textMuted },
  service: { fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.warning, backgroundColor: colors.warningBg, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.lg },
  total: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.lg, gap: spacing.xs, minWidth: 300 },
  unit: { backgroundColor: colors.primaryLight },
  totalLabel: { color: '#D5DEEA', fontSize: font.size.sm, fontWeight: font.weight.bold },
  totalValue: { color: colors.onPrimary, fontSize: 32, fontWeight: font.weight.bold, fontVariant: ['tabular-nums'] },
});
