// W-01 Panel principal (RF-04, RF-37): what needs each office role's attention today.
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LinkButton } from '@/components/Button';
import { LineChart } from '@/components/Chart';
import { Icon } from '@/components/Icon';
import { StatusBadge } from '@/components/StatusBadge';
import { Kpi, type KpiTone } from '@/components/web/Kpi';
import { Card, Col, EmptyState, Page, Row } from '@/components/web/Page';
import { can } from '@/domain/permissions';
import { formatLongDate, formatNumber, formatPercent, formatTime, greeting, monthName, monthShort } from '@/format';
import { useDataStore } from '@/store/data';
import { attentionItems, lastPlantRecord } from '@/store/selectors';
import { useCurrentUser } from '@/store/session';
import { chartColors, colors, font, spacing } from '@/theme';

const go = (path: string) => router.push(path as Href);

export default function PanelScreen() {
  const user = useCurrentUser()!;
  const db = useDataStore((s) => s.db);
  const now = new Date();
  const role = user.role;

  const items = attentionItems(db, role, now);
  const pendingExceptions = db.quotes.filter((q) => q.exception?.status === 'pending');
  const inProgress = db.orders.filter((o) => o.status === 'inProgress');
  const toValidate = db.orders.filter((o) => o.status === 'toValidate');
  const productCode = (orderSalesId: string) => {
    const so = db.salesOrders.find((s) => s.id === orderSalesId);
    return db.products.find((p) => p.id === so?.productId)?.code ?? '';
  };
  const last = lastPlantRecord(db);

  // Plant waste of last month against the threshold (RF-41).
  const months = [...new Set(db.monthlyWaste.map((w) => w.month))].sort();
  const lastMonth = months[months.length - 2] ?? months[months.length - 1];
  const waste = db.monthlyWaste.find((w) => w.month === lastMonth && w.section === 'all')?.wastePct ?? 0;
  const overWaste = waste > db.settings.maxWastePct;
  const quotesToConfirm = db.quotes.filter((q) => q.status === 'authorized');

  type K = { key: string; icon: Parameters<typeof Kpi>[0]['icon']; label: string; value: string; detail: string; tone: KpiTone; path: string };
  const exceptionsKpi: K = {
    key: 'exceptions',
    icon: 'checkSquare',
    label: role === 'adm' ? 'Excepciones por autorizar' : 'Excepciones en espera',
    value: String(pendingExceptions.length),
    detail: pendingExceptions.length ? `Cotización ${pendingExceptions.map((q) => q.code).join(', ')}` : 'Ninguna pendiente',
    tone: pendingExceptions.length ? 'warning' : 'neutral',
    path: role === 'adm' ? '/excepciones' : '/cotizaciones',
  };
  const inProgressKpi: K = {
    key: 'inProgress',
    icon: 'factory',
    label: 'Órdenes en proceso',
    value: String(inProgress.length),
    detail: last ? `Último registro ${formatTime(last)}` : 'Sin registros todavía',
    tone: 'neutral',
    path: '/seguimiento',
  };
  const toValidateKpi: K = {
    key: 'toValidate',
    icon: 'clipboard',
    label: 'Órdenes por validar',
    value: String(toValidate.length),
    detail: toValidate.length ? toValidate.map((o) => `${o.code} · ${productCode(o.salesOrderId)}`).join(', ') : 'Ninguna por validar',
    tone: toValidate.length ? 'warning' : 'neutral',
    path: toValidate.length === 1 ? `/seguimiento/${toValidate[0].id}` : '/seguimiento',
  };
  const wasteKpi: K = {
    key: 'waste',
    icon: 'waste',
    label: `Merma de ${monthName(lastMonth)}`,
    value: formatPercent(waste),
    detail: `${overWaste ? 'Sobre' : 'Bajo'} el umbral de ${formatPercent(db.settings.maxWastePct)}`,
    tone: overWaste ? 'alert' : 'success',
    path: '/indicadores',
  };
  const quotesKpi: K = {
    key: 'quotes',
    icon: 'calculator',
    label: 'Cotizaciones por confirmar',
    value: String(quotesToConfirm.length),
    detail: quotesToConfirm.length ? quotesToConfirm.map((q) => q.code).join(', ') : 'Ninguna autorizada',
    tone: quotesToConfirm.length ? 'success' : 'neutral',
    path: '/cotizaciones',
  };
  const requestsKpi: K = {
    key: 'requests',
    icon: 'cart',
    label: 'Solicitudes por cotizar',
    value: String(db.quotes.filter((q) => q.status === 'draft').length),
    detail: 'Registre y cotice desde Solicitudes',
    tone: 'neutral',
    path: '/solicitudes',
  };
  const kpis: K[] =
    role === 'adm'
      ? [exceptionsKpi, inProgressKpi, toValidateKpi, wasteKpi]
      : role === 'ven'
        ? [requestsKpi, exceptionsKpi, quotesKpi, inProgressKpi]
        : [inProgressKpi, toValidateKpi, wasteKpi, { ...requestsKpi, key: 'plan', icon: 'calendar', label: 'Líneas por planificar', value: String(db.salesOrders.filter((s) => s.status === 'pending').length), detail: 'Genere la orden desde Planificación', path: '/planificacion' }];

  // Estimated unit cost of FI-4060 in the last 6 months; only roles that see costs (RF-04).
  const fi = db.products.find((p) => p.code === 'FI-4060');
  const series = db.monthlyUnitCosts.filter((m) => m.productId === fi?.id).sort((a, b) => a.month.localeCompare(b.month));
  const change = series.length > 1 ? (series[series.length - 1].unitCost - series[0].unitCost) / series[0].unitCost : 0;
  const showCost = can(role, 'estimatedCost') && fi && series.length > 1;
  const wasteSeries = months.map((m) => db.monthlyWaste.find((w) => w.month === m && w.section === 'all')?.wastePct ?? 0);

  return (
    <Page title={`${greeting(now)}, ${user.name.split(' ')[0]}`} subtitle={`${formatLongDate(now)} · Lo que requiere su atención hoy`} testID="screen-W-01">
      <Row gap={spacing.xl}>
        {kpis.map(({ key, ...k }) => (
          <Kpi key={key} {...k} onPress={() => go(k.path)} testID={`kpi-${key}`} />
        ))}
      </Row>
      <Row gap={spacing.xl}>
        <Col flex={1.43} minWidth={420}>
          <Card title="Requiere su atención">
            {items.length === 0 && <EmptyState text="No hay pendientes por ahora." />}
            <View style={styles.list}>
              {items.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => go(item.path)}
                  accessibilityRole="link"
                  style={(s) => [styles.item, (s as { hovered?: boolean }).hovered && styles.itemHover]}
                  testID={`attention-${item.id}`}
                >
                  <StatusBadge label={item.tag} tone={item.tone} />
                  <View style={styles.itemText}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemDetail}>{item.detail}</Text>
                  </View>
                  <Icon name="chevronRight" color={colors.text} size={18} />
                </Pressable>
              ))}
            </View>
          </Card>
        </Col>
        <Col minWidth={340}>
          {showCost ? (
            <Card title={`Costo unitario de ${fi!.code}`} subtitle="USD por funda · costo estimado" actions={<LinkButton title="Ver reportes" onPress={() => go(role === 'adm' ? '/reportes-economicos' : '/cotizaciones')} />}>
              <LineChart
                compact
                height={200}
                categories={series.map((m) => monthShort(m.month))}
                series={[{ name: fi!.code, values: series.map((m) => m.unitCost), color: chartColors[0] }]}
                formatValue={(v) => `${formatNumber(v, 4)} USD`}
                title={`Costo unitario de ${fi!.code}`}
              />
              <Text style={[styles.trend, { color: change > 0 ? colors.alert : colors.success }]}>
                {change > 0 ? '▲' : '▼'} {formatPercent(Math.abs(change))} en 6 meses, por el precio de la resina.
              </Text>
            </Card>
          ) : (
            <Card title="Merma de la planta" subtitle="Promedio mensual ponderado por kilogramos">
              <LineChart
                compact
                height={200}
                categories={months.map(monthShort)}
                series={[{ name: 'Merma', values: wasteSeries, color: chartColors[0] }]}
                formatValue={(v) => formatPercent(v)}
                title="Merma de la planta"
              />
              <Text style={[styles.trend, { color: overWaste ? colors.alert : colors.success }]}>
                Umbral vigente: {formatPercent(db.settings.maxWastePct)} por etapa.
              </Text>
            </Card>
          )}
        </Col>
      </Row>
    </Page>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  itemHover: { borderColor: '#B9C4D3', backgroundColor: '#FAFBFD' },
  itemText: { flex: 1, gap: 2 },
  itemTitle: { fontSize: 15, fontWeight: font.weight.semibold, color: colors.text },
  itemDetail: { fontSize: 13, color: colors.textMuted },
  trend: { fontSize: 13, fontWeight: font.weight.medium },
});
