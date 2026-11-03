// W-01 Panel principal (RF-03, RF-42). Indicators, pending items and orders, filtered by role.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LineChart } from '@/components/Chart';
import { Icon } from '@/components/Icon';
import { OrderStatusBadge } from '@/components/StatusBadge';
import { DataTable } from '@/components/web/DataTable';
import { KpiCard } from '@/components/web/KpiCard';
import { Card, Col, Page, Row } from '@/components/web/Page';
import { can } from '@/domain/permissions';
import { orderWaste } from '@/domain/production';
import type { ProductionOrder } from '@/domain/types';
import { formatDate, formatMonth, formatPercent, formatUnitCost } from '@/format';
import { go } from '@/navigation/go';
import { screenById } from '@/navigation/screens';
import { useDataStore } from '@/store/data';
import { orderInfo } from '@/store/selectors';
import { useCurrentUser } from '@/store/session';
import { colors, font, radius, spacing } from '@/theme';

export default function PanelScreen() {
  const user = useCurrentUser()!;
  const db = useDataStore((s) => s.db);
  const role = user.role;
  const seesCosts = can(role, 'orderCosts') || can(role, 'priceLookup');
  const seesReports = can(role, 'reports');
  const allowed = (id: keyof typeof screenById) => screenById[id].roles.includes(role);

  const inProgress = db.orders.filter((o) => o.status === 'inProgress');
  const toValidate = db.orders.filter((o) => o.status === 'toValidate');
  const months = [...new Set(db.monthlyUnitCosts.map((m) => m.month))].sort().slice(-6);
  const currentMonth = months.at(-1)!;
  const monthCosts = db.monthlyUnitCosts.filter((m) => m.month === currentMonth);
  const avgUnitCost = monthCosts.reduce((t, m) => t + m.unitCost, 0) / Math.max(1, monthCosts.length);
  const monthWaste = db.monthlyWaste.filter((m) => m.month === currentMonth);
  const avgWaste = monthWaste.reduce((t, m) => t + m.wastePct, 0) / Math.max(1, monthWaste.length);

  const pending: { key: string; title: string; detail: string; path: string }[] = [];
  if (allowed('W-06'))
    for (const r of db.recipes.filter((x) => x.status === 'draft')) {
      const p = db.products.find((x) => x.id === r.productId)!;
      pending.push({ key: r.id, title: `Receta ${p.code} v${r.version} por aprobar`, detail: p.name, path: '/recetas/aprobacion' });
    }
  if (allowed('W-17'))
    for (const pp of db.priceProposals.filter((x) => x.status === 'proposed')) {
      const p = db.products.find((x) => x.id === pp.productId)!;
      pending.push({ key: pp.id, title: `Precio ${p.code} por aprobar`, detail: `${formatUnitCost(pp.price)} · margen ${formatPercent(pp.margin)}`, path: '/precios/aprobacion' });
    }
  if (allowed('W-09'))
    for (const o of toValidate) pending.push({ key: o.id, title: `${o.code} por validar`, detail: orderInfo(db, o.id)!.product.name, path: `/ordenes/${o.id}` });
  if (role === 'ven')
    for (const pp of db.priceProposals.filter((x) => x.status === 'proposed' && x.proposedBy === user.id)) {
      const p = db.products.find((x) => x.id === pp.productId)!;
      pending.push({ key: pp.id, title: `Propuesta ${p.code} en revisión`, detail: `${formatUnitCost(pp.price)} enviada a la Administradora`, path: '/precios/simulador' });
    }
  if (allowed('W-08'))
    for (const so of db.salesOrders.filter((s) => s.status === 'pending')) {
      const p = db.products.find((x) => x.id === so.productId)!;
      pending.push({ key: so.id, title: `${so.code} sin orden de producción`, detail: `${p.code} · entrega ${formatDate(so.dueDate)}`, path: `/ordenes/nueva?pedido=${so.id}` });
    }

  const orderPath = (o: ProductionOrder) =>
    allowed('W-09') ? `/ordenes/${o.id}` : o.status === 'closed' && allowed('W-14') ? `/costos/ordenes/${o.id}` : undefined;
  const visibleOrders = can(role, 'productionOrders') || can(role, 'orderCosts') ? [...db.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];

  return (
    <Page>
      <Row>
        <KpiCard testID="kpi-in-progress" label="Órdenes en proceso" value={String(inProgress.length)} detail={`${db.orders.filter((o) => o.status === 'pending').length} pendientes de iniciar`} onPress={allowed('W-10') ? () => go('/planta') : undefined} />
        <KpiCard
          label="Órdenes por validar"
          value={String(toValidate.length)}
          tone={toValidate.length ? 'warning' : 'neutral'}
          detail="Cerradas en empacado"
          onPress={allowed('W-09') && toValidate[0] ? () => go(`/ordenes/${toValidate[0].id}`) : undefined}
        />
        {seesCosts && (
          <KpiCard label="Costo unitario promedio del mes" value={formatUnitCost(avgUnitCost)} detail={`${formatMonth(currentMonth)} · ${monthCosts.length} fundas`} onPress={allowed('W-20') ? () => go('/reportes/tablero') : allowed('W-18') ? () => go('/consulta') : undefined} />
        )}
        {seesReports && (
          <KpiCard
            label="Merma del mes"
            value={formatPercent(avgWaste)}
            tone={avgWaste > db.settings.maxWastePct ? 'alert' : 'success'}
            detail={`Máximo ${formatPercent(db.settings.maxWastePct, 0)} por orden`}
            onPress={allowed('W-20') ? () => go('/reportes/tablero') : allowed('W-19') ? () => go('/reportes/tiempos') : undefined}
          />
        )}
      </Row>

      <Row>
        <Col minWidth={360}>
          <Card title="Pendientes" subtitle={pending.length ? `${pending.length} por atender` : undefined}>
            {pending.length === 0 && <Text style={styles.muted}>No tiene pendientes.</Text>}
            {pending.map((p) => (
              <Pressable key={p.key} onPress={() => go(p.path)} style={(s) => [styles.pending, (s as { hovered?: boolean }).hovered && styles.pendingHover]} accessibilityRole="link" testID={`pending-${p.key}`}>
                <View style={styles.pendingText}>
                  <Text style={styles.pendingTitle}>{p.title}</Text>
                  <Text style={styles.muted}>{p.detail}</Text>
                </View>
                <Icon name="chevronRight" color={colors.primary} size={18} />
              </Pressable>
            ))}
          </Card>
        </Col>
        {seesCosts && (
          <Col minWidth={420} flex={1.4}>
            <Card title="Costo unitario por funda" subtitle="Últimos 6 meses (USD por unidad)">
              <LineChart
                height={200}
                categories={months.map(formatMonth)}
                series={db.products.map((p) => ({ name: p.code, values: months.map((m) => db.monthlyUnitCosts.find((x) => x.month === m && x.productId === p.id)?.unitCost ?? null) }))}
                formatValue={(n) => formatUnitCost(n).replace(' USD', '')}
              />
            </Card>
          </Col>
        )}
      </Row>

      {visibleOrders.length > 0 && (
        <Card title="Órdenes de producción" padded={false}>
          <DataTable
            rows={visibleOrders}
            rowKey={(o) => o.id}
            onRowPress={(o) => {
              const path = orderPath(o);
              if (path) go(path);
            }}
            highlight={(o) => (orderWaste(db, o.id).alert && o.status !== 'closed' ? 'alert' : undefined)}
            columns={[
              { key: 'code', title: 'Orden', flex: 0.8, render: (o) => o.code },
              { key: 'product', title: 'Funda', flex: 1.6, render: (o) => { const i = orderInfo(db, o.id)!; return `${i.product.code} · ${i.product.name}`; } },
              { key: 'customer', title: 'Cliente', flex: 1.4, render: (o) => orderInfo(db, o.id)!.customer.name },
              { key: 'due', title: 'Entrega', flex: 0.8, render: (o) => formatDate(orderInfo(db, o.id)!.salesOrder.dueDate) },
              { key: 'waste', title: 'Merma', flex: 0.6, align: 'right', render: (o) => { const w = orderWaste(db, o.id); return w.rawKg ? formatPercent(w.fraction) : '—'; } },
              { key: 'status', title: 'Estado', flex: 0.9, render: (o) => <OrderStatusBadge status={o.status} /> },
            ]}
          />
        </Card>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: font.size.sm, color: colors.textMuted },
  pending: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.sm, backgroundColor: colors.surface },
  pendingHover: { backgroundColor: colors.restBg },
  pendingText: { flex: 1, gap: 2 },
  pendingTitle: { fontSize: font.size.md, fontWeight: font.weight.bold, color: colors.text },
});
