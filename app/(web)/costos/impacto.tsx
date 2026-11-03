// W-15 Impacto de cambio de precio (RF-34). Standard costs recalculated for the affected products only.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { SelectField } from '@/components/Inputs';
import { DataTable } from '@/components/web/DataTable';
import { Card, Note, Page, Row } from '@/components/web/Page';
import { recalcStandardCosts } from '@/domain/costing';
import { materialUnitLabels } from '@/domain/labels';
import { referencePrice } from '@/domain/prices';
import { formatMoney, formatPercent, formatUnitCost } from '@/format';
import { go } from '@/navigation/go';
import { useDataStore } from '@/store/data';
import { useUiStore } from '@/store/ui';
import { colors, font, radius, spacing } from '@/theme';

export default function PriceImpactScreen() {
  const db = useDataStore((s) => s.db);
  const lastChange = useUiStore((s) => s.lastPriceChange);
  const setPreset = useUiStore((s) => s.setSimulatorPreset);
  const now = new Date().toISOString();
  const [materialId, setMaterialId] = useState(lastChange?.materialId ?? 'm-pebd');
  const material = db.materials.find((m) => m.id === materialId)!;

  // Change shown: the last price saved in W-11 for this material, or its latest change in the history.
  let change: { oldPrice: number; newPrice: number; source: string };
  if (lastChange && lastChange.materialId === materialId) {
    change = { oldPrice: lastChange.oldPrice, newPrice: lastChange.newPrice, source: 'Precio registrado en esta sesión' };
  } else {
    const latest = db.supplierPrices.filter((p) => p.materialId === materialId).map((p) => p.validFrom).sort().at(-1)!;
    const before = new Date(`${latest}T12:00:00`);
    before.setDate(before.getDate() - 1);
    change = { oldPrice: referencePrice(db.supplierPrices, db.suppliers, materialId, before.toISOString()), newPrice: referencePrice(db.supplierPrices, db.suppliers, materialId, now), source: 'Último cambio del historial' };
  }
  const rows = recalcStandardCosts(db, { materialId, oldPrice: change.oldPrice, newPrice: change.newPrice }, now);
  const unit = materialUnitLabels[material.unit];

  return (
    <Page>
      <Row align="flex-end">
        <View style={{ width: 420 }}>
          <SelectField label="Insumo" value={materialId} onChange={setMaterialId} options={db.materials.map((m) => ({ value: m.id, label: `${m.code} · ${m.name}` }))} testID="impact-material" />
        </View>
      </Row>
      <Card title="Resumen del cambio" subtitle={change.source}>
        <Row align="center" gap={spacing.xl}>
          <View style={styles.box}>
            <Text style={styles.label}>Insumo</Text>
            <Text style={styles.value}>{material.code}</Text>
            <Text style={styles.muted}>{material.name}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.label}>Precio anterior</Text>
            <Text style={styles.value}>
              {formatMoney(change.oldPrice)}/{unit}
            </Text>
          </View>
          <Text style={styles.arrow}>→</Text>
          <View style={styles.box}>
            <Text style={styles.label}>Precio nuevo</Text>
            <Text style={[styles.value, { color: colors.primary }]}>
              {formatMoney(change.newPrice)}/{unit}
            </Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.label}>Variación del insumo</Text>
            <Text style={styles.value}>{change.oldPrice ? formatPercent((change.newPrice - change.oldPrice) / change.oldPrice) : '—'}</Text>
          </View>
        </Row>
      </Card>
      <Card title="Fundas afectadas" subtitle="Solo las fundas cuya receta aprobada usa el insumo" padded={false}>
        <DataTable
          rows={rows}
          rowKey={(r) => r.productId}
          emptyText="Ninguna receta aprobada usa este insumo."
          columns={[
            { key: 'p', title: 'Funda', flex: 2, render: (r) => { const p = db.products.find((x) => x.id === r.productId)!; return `${p.code} · ${p.name}`; } },
            { key: 'b', title: 'Costo estándar anterior', align: 'right', render: (r) => formatUnitCost(r.before) },
            { key: 'a', title: 'Costo estándar nuevo', align: 'right', render: (r) => formatUnitCost(r.after) },
            {
              key: 'v',
              title: 'Variación',
              align: 'right',
              flex: 0.7,
              render: (r) => <Text style={{ color: r.variation > 0 ? colors.alert : colors.success, fontWeight: font.weight.bold, fontSize: font.size.sm + 1 }}>{`${r.variation > 0 ? '+' : ''}${formatPercent(r.variation, 2)}`}</Text>,
            },
            {
              key: 'go',
              title: '',
              minWidth: 160,
              render: (r) => (
                <Button
                  title="Ir a simulador"
                  variant="ghost"
                  onPress={() => {
                    setPreset({ productId: r.productId, unitCost: r.after, source: `costo estándar con ${material.code} a ${formatMoney(change.newPrice)}` });
                    go('/precios/simulador');
                  }}
                />
              ),
            },
          ]}
        />
      </Card>
      <Note tone="info">Las órdenes ya cerradas no cambian: conservan el costo con el que se calcularon al validarse.</Note>
    </Page>
  );
}

const styles = StyleSheet.create({
  box: { gap: 2, minWidth: 140 },
  label: { fontSize: 12, fontWeight: font.weight.bold, color: colors.textMuted, textTransform: 'uppercase' },
  value: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.text },
  muted: { fontSize: font.size.sm, color: colors.textMuted },
  arrow: { fontSize: 28, color: colors.textMuted, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
});
