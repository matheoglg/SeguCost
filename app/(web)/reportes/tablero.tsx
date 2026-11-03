// W-20 Tablero de costos y mermas (RF-42, RF-35). Changing the period updates the three charts.
import { useState } from 'react';
import { View } from 'react-native';

import { BarChart, LineChart } from '@/components/Chart';
import { Segmented, SelectField } from '@/components/Inputs';
import { DataTable } from '@/components/web/DataTable';
import { Card, Col, Page, Row } from '@/components/web/Page';
import { sectionLabels } from '@/domain/labels';
import { inForce } from '@/domain/prices';
import type { MachineSection } from '@/domain/types';
import { formatDate, formatMonth, formatMoney, formatNumber, formatPercent, formatUnitCost } from '@/format';
import { go } from '@/navigation/go';
import { useDataStore } from '@/store/data';
import { orderInfo } from '@/store/selectors';

type Period = '3' | '6';

export default function CostDashboardScreen() {
  const db = useDataStore((s) => s.db);
  const [period, setPeriod] = useState<Period>('6');
  const [materialId, setMaterialId] = useState('m-pebd');
  const allMonths = [...new Set(db.monthlyUnitCosts.map((m) => m.month))].sort();
  const months = allMonths.slice(-Number(period));
  const labels = months.map(formatMonth);

  const prices = db.supplierPrices.filter((p) => p.materialId === materialId);
  const suppliers = db.suppliers.filter((s) => prices.some((p) => p.supplierId === s.id));
  const sections = Object.keys(sectionLabels) as MachineSection[];
  const services = db.orderCosts.filter((c) => c.isService);

  return (
    <Page>
      <Row align="center">
        <Segmented<Period> label="Período" value={period} onChange={setPeriod} options={[{ value: '3', label: 'Últimos 3 meses' }, { value: '6', label: 'Últimos 6 meses' }]} testID="period" />
      </Row>
      <Card title="Costo unitario mensual por funda" subtitle="USD por unidad (costo real de las órdenes cerradas)">
        <LineChart
          categories={labels}
          series={db.products.map((p) => ({ name: p.code, values: months.map((m) => db.monthlyUnitCosts.find((x) => x.month === m && x.productId === p.id)?.unitCost ?? null) }))}
          formatValue={(n) => formatUnitCost(n).replace(' USD', '')}
          testID="chart-unit-cost"
        />
      </Card>
      <Row>
        <Col minWidth={460}>
          <Card title="Precio por insumo y proveedor" subtitle="USD por unidad del insumo, vigente cada mes">
            <View style={{ width: 360 }}>
              <SelectField label="Insumo" value={materialId} onChange={setMaterialId} options={db.materials.filter((m) => m.active).map((m) => ({ value: m.id, label: `${m.code} · ${m.name}` }))} />
            </View>
            <LineChart
              categories={labels}
              series={suppliers.map((s) => ({ name: s.name, values: months.map((m) => inForce(prices.filter((p) => p.supplierId === s.id), `${m}-28`)?.price ?? null) }))}
              formatValue={(n) => formatNumber(n, 2)}
              testID="chart-prices"
            />
          </Card>
        </Col>
        <Col minWidth={460}>
          <Card title="% de merma por sección" subtitle="Merma sobre materia prima usada">
            <BarChart
              categories={labels}
              series={sections.map((s) => ({ name: sectionLabels[s], values: months.map((m) => (db.monthlyWaste.find((w) => w.month === m && w.section === s)?.wastePct ?? 0) * 100) }))}
              formatValue={(n) => `${formatNumber(n, 1)} %`}
              testID="chart-waste"
            />
          </Card>
        </Col>
      </Row>
      <Card title="Servicios a terceros" subtitle="Se reportan aparte: no incluyen materia prima propia (RF-35)" padded={false}>
        <DataTable
          rows={services}
          rowKey={(c) => c.orderId}
          onRowPress={(c) => go(`/costos/ordenes/${c.orderId}`)}
          emptyText="Sin servicios cerrados en el período."
          columns={[
            { key: 'o', title: 'Orden', flex: 0.7, render: (c) => orderInfo(db, c.orderId)!.order.code },
            { key: 'c', title: 'Cliente', flex: 1.4, render: (c) => orderInfo(db, c.orderId)!.customer.name },
            { key: 'p', title: 'Funda', render: (c) => orderInfo(db, c.orderId)!.product.code },
            { key: 'l', title: 'Mano de obra', align: 'right', render: (c) => formatMoney(c.labor) },
            { key: 'm', title: 'Máquina', align: 'right', render: (c) => formatMoney(c.machine) },
            { key: 't', title: 'Costo total', align: 'right', render: (c) => formatMoney(c.total) },
            { key: 'u', title: 'Costo unitario', align: 'right', render: (c) => formatUnitCost(c.unitCost) },
            { key: 'd', title: 'Cerrada', render: (c) => formatDate(c.computedAt) },
          ]}
        />
      </Card>
      <Card title="Merma mensual por sección (tabla)" padded={false}>
        <DataTable
          rows={sections}
          rowKey={(s) => s}
          columns={[
            { key: 's', title: 'Sección', render: (s) => sectionLabels[s] },
            ...months.map((m) => ({ key: m, title: formatMonth(m), align: 'right' as const, flex: 0.7, render: (s: MachineSection) => formatPercent(db.monthlyWaste.find((w) => w.month === m && w.section === s)?.wastePct ?? 0) })),
          ]}
        />
      </Card>
    </Page>
  );
}
