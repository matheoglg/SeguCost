// W-11 Proveedores y precios (RF-26, RF-27). Price per supplier with origin, lead time and validity.
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { LineChart } from '@/components/Chart';
import { Segmented, SelectField } from '@/components/Inputs';
import { StatusBadge } from '@/components/StatusBadge';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { DataTable } from '@/components/web/DataTable';
import { Card, Col, Note, Page, Row } from '@/components/web/Page';
import { recalcStandardCosts } from '@/domain/costing';
import { materialUnitLabels, originLabels } from '@/domain/labels';
import { can } from '@/domain/permissions';
import { inForce, quotesFor, referenceQuote } from '@/domain/prices';
import type { Origin } from '@/domain/types';
import { formatDate, formatMonth, formatMoney, formatNumber, parseDateInput, parseNumber, todayInput } from '@/format';
import { go } from '@/navigation/go';
import { saveSupplierPrice } from '@/store/actions';
import { useDataStore } from '@/store/data';
import { useCurrentUser } from '@/store/session';
import { useUiStore } from '@/store/ui';
import { colors, font, spacing } from '@/theme';

type Form = { materialId?: string; origin: Origin; supplierId?: string; price: string; lead: string; validFrom: string };

export default function SupplierPricesScreen() {
  const user = useCurrentUser()!;
  const db = useDataStore((s) => s.db);
  const lastChange = useUiStore((s) => s.lastPriceChange);
  const canEdit = can(user.role, 'supplierPrices', 'full');
  const now = new Date().toISOString();
  const [form, setForm] = useState<Form>({ origin: 'local', price: '', lead: '', validFrom: todayInput() });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [historyMaterial, setHistoryMaterial] = useState('m-pebd');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const set = (patch: Partial<Form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => ({ ...e, ...Object.fromEntries(Object.keys(patch).map((k) => [k, ''])) }));
  };

  const current = db.materials
    .filter((m) => m.active)
    .flatMap((m) => {
      const ref = referenceQuote(db.supplierPrices, db.suppliers, m.id, now);
      return quotesFor(db.supplierPrices, db.suppliers, m.id, now).map((q) => ({ material: m, ...q, isReference: ref?.price.id === q.price.id }));
    });

  const save = () => {
    const r = saveSupplierPrice({ materialId: form.materialId, supplierId: form.supplierId, price: parseNumber(form.price), leadTimeDays: parseNumber(form.lead), validFrom: parseDateInput(form.validFrom) });
    if (!r.ok) {
      setErrors(r.errors);
      return showToast('error', Object.values(r.errors)[0]);
    }
    showToast('success', r.value.affects ? 'Precio guardado: cambió el precio de referencia del insumo' : 'Precio guardado en el historial');
    setHistoryMaterial(form.materialId!);
    setForm((f) => ({ ...f, price: '', lead: '' }));
  };

  const affected =
    lastChange && lastChange.oldPrice !== lastChange.newPrice ? recalcStandardCosts(db, { materialId: lastChange.materialId, oldPrice: lastChange.oldPrice, newPrice: lastChange.newPrice }, now) : [];

  // History of the selected material: one series per supplier, monthly.
  const hist = db.supplierPrices.filter((p) => p.materialId === historyMaterial).sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  const months = [...new Set(hist.map((p) => p.validFrom.slice(0, 7)))];
  const suppliersOf = db.suppliers.filter((s) => hist.some((p) => p.supplierId === s.id));
  const fromKey = parseDateInput(from);
  const toKey = parseDateInput(to);
  const histRows = [...hist].reverse().filter((p) => (!fromKey || p.validFrom >= fromKey) && (!toKey || p.validFrom <= toKey));
  const unit = materialUnitLabels[db.materials.find((m) => m.id === historyMaterial)?.unit ?? 'kg'];
  const supplierOptions = db.suppliers.filter((s) => s.origin === form.origin);

  return (
    <Page>
      {affected.length > 0 && lastChange && (
        <Card>
          <Row align="center">
            <View style={{ flex: 1, minWidth: 300 }}>
              <Note tone="warning">
                El precio de referencia de {db.materials.find((m) => m.id === lastChange.materialId)!.code} pasó de {formatMoney(lastChange.oldPrice)} a {formatMoney(lastChange.newPrice)}:{' '}
                {affected.length} funda{affected.length === 1 ? '' : 's'} con costo estándar afectado ({affected.map((a) => db.products.find((p) => p.id === a.productId)!.code).join(', ')}).
              </Note>
            </View>
            <Button title="Ver impacto en costos" onPress={() => go('/costos/impacto')} testID="see-impact" />
          </Row>
        </Card>
      )}
      <Row>
        <Col minWidth={640} flex={2}>
          <Card title="Precios vigentes por insumo y proveedor" subtitle="El precio de referencia es el de vigencia más reciente; se usa para el costeo" padded={false}>
            <DataTable
              rows={current}
              rowKey={(r) => r.price.id}
              columns={[
                { key: 'm', title: 'Insumo', flex: 0.6, minWidth: 80, render: (r) => r.material.code },
                { key: 's', title: 'Proveedor', flex: 1.6, minWidth: 170, render: (r) => r.supplier.name },
                { key: 'o', title: 'Origen', flex: 0.6, minWidth: 90, render: (r) => originLabels[r.supplier.origin] },
                { key: 'p', title: 'Precio', align: 'right', flex: 0.8, minWidth: 110, render: (r) => `${formatMoney(r.price.price)}/${materialUnitLabels[r.material.unit]}` },
                { key: 'l', title: 'Plazo', align: 'right', flex: 0.5, minWidth: 80, render: (r) => (r.price.leadTimeDays ? `${r.price.leadTimeDays} días` : '—') },
                { key: 'v', title: 'Vigencia', flex: 0.7, minWidth: 100, render: (r) => formatDate(r.price.validFrom) },
                { key: 'r', title: '', flex: 0.7, minWidth: 110, render: (r) => (r.isReference ? <StatusBadge label="Referencia" tone="info" /> : null) },
              ]}
            />
          </Card>
        </Col>
        {canEdit && (
          <Col minWidth={340}>
            <Card title="Registrar precio">
              <SelectField label="Insumo" value={form.materialId} onChange={(v) => set({ materialId: v })} options={db.materials.filter((m) => m.active).map((m) => ({ value: m.id, label: `${m.code} · ${m.name}` }))} error={errors.materialId} testID="price-material" />
              <Segmented label="Origen" value={form.origin} onChange={(v) => set({ origin: v, supplierId: undefined })} options={(['local', 'imported', 'own'] as Origin[]).map((o) => ({ value: o, label: originLabels[o] }))} testID="price-origin" />
              <SelectField label="Proveedor" value={form.supplierId} onChange={(v) => set({ supplierId: v })} options={supplierOptions.map((s) => ({ value: s.id, label: s.name }))} error={errors.supplierId} testID="price-supplier" />
              <Row gap={spacing.md}>
                <View style={{ flex: 1, minWidth: 120 }}>
                  <TextField label="Precio (USD)" value={form.price} onChangeText={(t) => set({ price: t })} keyboardType="decimal-pad" error={errors.price} placeholder="1,58" testID="price-value" />
                </View>
                <View style={{ flex: 1, minWidth: 120 }}>
                  <TextField
                    label="Plazo de llegada (días)"
                    value={form.lead}
                    onChangeText={(t) => set({ lead: t })}
                    keyboardType="numeric"
                    error={errors.leadTimeDays}
                    hint={form.origin === 'imported' ? 'Obligatorio para importados' : 'Solo importados'}
                    editable={form.origin === 'imported'}
                    testID="price-lead"
                  />
                </View>
              </Row>
              <TextField label="Vigente desde" value={form.validFrom} onChangeText={(t) => set({ validFrom: t })} placeholder="dd/mm/aaaa" error={errors.validFrom} />
              <Button title="Guardar precio" onPress={save} testID="save-price" />
            </Card>
          </Col>
        )}
      </Row>

      <Card title="Historial de precios" subtitle="Por insumo y proveedor (RF-27)">
        <Row align="flex-end">
          <View style={{ width: 360 }}>
            <SelectField label="Insumo" value={historyMaterial} onChange={setHistoryMaterial} options={db.materials.map((m) => ({ value: m.id, label: `${m.code} · ${m.name}` }))} testID="history-material" />
          </View>
          <View style={{ width: 160 }}>
            <TextField label="Desde" value={from} onChangeText={setFrom} placeholder="dd/mm/aaaa" />
          </View>
          <View style={{ width: 160 }}>
            <TextField label="Hasta" value={to} onChangeText={setTo} placeholder="dd/mm/aaaa" />
          </View>
        </Row>
        {months.length > 1 ? (
          <LineChart
            height={220}
            categories={months.map(formatMonth)}
            series={suppliersOf.map((s) => ({
              name: s.name,
              values: months.map((m) => inForce(hist.filter((p) => p.supplierId === s.id), `${m}-28`)?.price ?? null),
            }))}
            formatValue={(n) => formatNumber(n, 2)}
          />
        ) : (
          <Text style={{ color: colors.textMuted, fontSize: font.size.sm }}>No hay suficiente historial para el gráfico.</Text>
        )}
        <DataTable
          rows={histRows}
          rowKey={(p) => p.id}
          emptyText="Sin precios en el rango de fechas."
          columns={[
            { key: 'v', title: 'Vigente desde', render: (p) => formatDate(p.validFrom) },
            { key: 's', title: 'Proveedor', flex: 1.6, render: (p) => db.suppliers.find((s) => s.id === p.supplierId)!.name },
            { key: 'p', title: 'Precio', align: 'right', render: (p) => `${formatMoney(p.price)}/${unit}` },
            { key: 'l', title: 'Plazo', align: 'right', render: (p) => (p.leadTimeDays ? `${p.leadTimeDays} días` : '—') },
          ]}
        />
      </Card>
    </Page>
  );
}
