// W-15 Precios de materias primas (RF-42, RF-43, RF-44): supplier references normalized to USD/kg,
// what each price includes, arrival days, difference against the best local price and the reference.
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, LinkButton } from '@/components/Button';
import { LineChart } from '@/components/Chart';
import { Dialog } from '@/components/Dialog';
import { SelectField } from '@/components/Inputs';
import { StatusBadge } from '@/components/StatusBadge';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { DataTable, type Column } from '@/components/web/DataTable';
import { Card, Col, Page, Row } from '@/components/web/Page';
import { materialUnitLabels, originLabels } from '@/domain/labels';
import { inForce, priceComparison, type PriceComparisonRow } from '@/domain/prices';
import type { Origin, Supplier } from '@/domain/types';
import type { FieldErrors } from '@/domain/validation';
import { formatDate, formatNumber, monthShort, parseDateInput, parseNumber, todayInput } from '@/format';
import { saveSupplier, saveSupplierPrice, setReferenceSupplier } from '@/store/actions';
import { useDataStore } from '@/store/data';
import { userName } from '@/store/selectors';
import { chartColors, colors, font, spacing } from '@/theme';

const NEW_SUPPLIER = '__new';
const days = (n?: number) => (n === undefined ? '—' : n === 0 ? 'Inmediato' : n === 1 ? '1 día' : `${n} días`);
const signedPct = (f: number) => `${f > 0 ? '+' : '−'}${formatNumber(Math.abs(f) * 100, 1)} %`;

export default function RawMaterialPricesScreen() {
  const db = useDataStore((s) => s.db);
  const params = useLocalSearchParams<{ material?: string }>();
  const [materialId, setMaterialId] = useState(params.material ?? db.materials.find((m) => m.active)?.id ?? db.materials[0].id);
  const [confirm, setConfirm] = useState<PriceComparisonRow | null>(null);
  const [historyOf, setHistoryOf] = useState<Supplier | null>(null);
  const [registering, setRegistering] = useState(false);

  const material = db.materials.find((m) => m.id === materialId)!;
  const now = new Date().toISOString();
  const rows = priceComparison(db.supplierPrices, db.suppliers, db.referencePrices, materialId, material.unit, now);
  const unit = material.unit === 'kg' ? 'kg' : materialUnitLabels[material.unit];
  const reference = rows.find((r) => r.isReference);
  const cheapestImported = rows.filter((r) => r.supplier.origin === 'imported').sort((a, b) => a.unitPrice - b.unitPrice)[0];

  // Six months of the best local supplier against the cheapest imported one (rows are sorted by price).
  const months = [...new Set(db.monthlyUnitCosts.map((m) => m.month))].sort().slice(-6);
  const bestLocal = rows.find((r) => r.supplier.origin !== 'imported');
  const chartSeries = [bestLocal, cheapestImported]
    .filter((r): r is PriceComparisonRow => Boolean(r))
    .map((r, i) => ({
      name: `${originLabels[r.supplier.origin]} · ${r.supplier.name.replace(' Import.', '')}`,
      color: chartColors[i],
      values: months.map((m) => {
        const end = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).toISOString();
        const p = inForce(db.supplierPrices.filter((x) => x.materialId === materialId && x.supplierId === r.supplier.id), end);
        return p ? p.price : null;
      }),
    }));

  const columns: Column<PriceComparisonRow>[] = [
    { key: 'supplier', title: 'Proveedor', flex: 2, minWidth: 200, render: (r) => r.supplier.name },
    { key: 'origin', title: 'Origen', flex: 1, minWidth: 110, render: (r) => <StatusBadge label={originLabels[r.supplier.origin]} tone={r.supplier.origin === 'imported' ? 'info' : 'neutral'} /> },
    {
      key: 'price',
      title: `USD/${unit}`,
      flex: 0.7,
      minWidth: 80,
      align: 'right',
      render: (r) => <Text style={[styles.num, r.isReference && styles.bold]}>{formatNumber(r.unitPrice, 2)}</Text>,
    },
    { key: 'includes', title: 'Qué incluye', flex: 1.6, minWidth: 170, render: (r) => r.price.includes ?? '—' },
    { key: 'lead', title: 'Llegada', flex: 0.8, minWidth: 90, align: 'right', render: (r) => days(r.price.leadTimeDays) },
    {
      key: 'diff',
      title: 'Vs. mejor local',
      flex: 1,
      minWidth: 120,
      align: 'right',
      render: (r) =>
        r.vsBestLocal === undefined ? (
          <Text style={styles.num}>—</Text>
        ) : (
          <Text style={[styles.num, styles.bold, { color: r.vsBestLocal > 0 ? colors.alert : colors.success }]}>{signedPct(r.vsBestLocal)}</Text>
        ),
    },
    {
      key: 'ref',
      title: '',
      flex: 1.5,
      minWidth: 200,
      align: 'right',
      render: (r) => (r.isReference ? <StatusBadge label="Referencia" tone="success" /> : <LinkButton title="Usar como referencia" onPress={() => setConfirm(r)} testID={`use-ref-${r.supplier.id}`} />),
    },
  ];

  return (
    <Page
      title="Precios de materias primas"
      subtitle={`Referencias por proveedor llevadas a USD por ${material.unit === 'kg' ? 'kilogramo' : materialUnitLabels[material.unit]}`}
      actions={<Button title="Registrar precio" onPress={() => setRegistering(true)} testID="register-price" />}
      testID="screen-W-15"
    >
      <View style={styles.selector}>
        <View style={{ width: 360 }}>
          <SelectField
            label="Materia prima"
            value={materialId}
            options={db.materials.map((m) => ({ value: m.id, label: `${m.code} · ${m.name}`, detail: m.active ? undefined : 'Inactivo' }))}
            onChange={setMaterialId}
            testID="price-material"
          />
        </View>
        <Text style={styles.selectorHint}>Precios registrados desde las facturas de compra. Toque un proveedor para ver su historial.</Text>
      </View>

      <DataTable framed columns={columns} rows={rows} rowKey={(r) => r.supplier.id} onRowPress={(r) => setHistoryOf(r.supplier)} emptyText="Esta materia prima aún no tiene precios registrados." testID="prices-table" />

      <Row gap={spacing.xl}>
        <Col flex={1.3} minWidth={420}>
          <Card title={`Precio de ${material.code} en 6 meses`} subtitle={`USD por ${unit}`}>
            {chartSeries.length > 0 && chartSeries.some((s) => s.values.some((v) => v !== null)) ? (
              <LineChart
                compact
                legend
                height={190}
                categories={months.map(monthShort)}
                series={chartSeries}
                formatValue={(v) => `${formatNumber(v, 2)} USD`}
                title={`Precio de ${material.code} en 6 meses`}
              />
            ) : (
              <Text style={styles.muted}>Sin historial de precios.</Text>
            )}
          </Card>
        </Col>
        <Col minWidth={340}>
          <Card title="Antes de cambiar la referencia">
            {cheapestImported && <Text style={styles.bullet}>• El precio importado tarda {days(cheapestImported.price.leadTimeDays)}: revise el inventario disponible.</Text>}
            <Text style={styles.bullet}>• Las cotizaciones aceptadas no cambian; las abiertas se recalculan.</Text>
            <Text style={styles.bullet}>• Registrar un precio no modifica facturas ni datos de Dobra.</Text>
          </Card>
        </Col>
      </Row>

      <Dialog
        visible={!!confirm}
        title={confirm ? `¿Usar ${confirm.supplier.name} como referencia?` : ''}
        onClose={() => setConfirm(null)}
        actions={
          <>
            <Button title="Cancelar" variant="secondary" onPress={() => setConfirm(null)} />
            <Button
              title="Usar como referencia"
              onPress={() => {
                setReferenceSupplier(materialId, confirm!.supplier.id);
                showToast('success', `${confirm!.supplier.name} es ahora la referencia de ${material.code}.`);
                setConfirm(null);
              }}
              testID="confirm-reference"
            />
          </>
        }
      >
        {confirm && (
          <Text style={styles.body}>
            Las estimaciones nuevas y las cotizaciones abiertas de {material.code} usarán {formatNumber(confirm.unitPrice, 2)} USD/{unit}
            {reference ? ` en lugar de ${formatNumber(reference.unitPrice, 2)}` : ''}. Las cotizaciones aceptadas no cambian.
            {confirm.supplier.origin === 'imported' ? ` Este proveedor tarda ${days(confirm.price.leadTimeDays)} en entregar.` : ''}
          </Text>
        )}
      </Dialog>

      <Dialog visible={!!historyOf} title={historyOf ? `Historial · ${historyOf.name}` : ''} onClose={() => setHistoryOf(null)}>
        {historyOf &&
          db.supplierPrices
            .filter((p) => p.materialId === materialId && p.supplierId === historyOf.id)
            .sort((a, b) => b.validFrom.localeCompare(a.validFrom))
            .map((p) => (
              <View key={p.id} style={styles.historyRow}>
                <Text style={styles.historyDate}>{formatDate(p.validFrom)}</Text>
                <Text style={[styles.historyPrice]}>
                  {formatNumber(p.price, 2)} USD/{p.priceUnit === 'lb' ? 'lb' : unit}
                </Text>
                <Text style={styles.muted}>{userName(db, p.createdBy)}</Text>
              </View>
            ))}
      </Dialog>

      {registering && <RegisterPriceDialog materialId={materialId} onClose={() => setRegistering(false)} />}
    </Page>
  );
}

/** Registers a price from a purchase invoice; can create the supplier on the spot (RF-42, RF-43). */
function RegisterPriceDialog({ materialId: initialMaterial, onClose }: { materialId: string; onClose: () => void }) {
  const db = useDataStore((s) => s.db);
  const [materialId, setMaterialId] = useState(initialMaterial);
  const [supplierId, setSupplierId] = useState<string | undefined>();
  const [newSupplier, setNewSupplier] = useState<{ name: string; origin?: Origin; contact: string }>({ name: '', contact: '' });
  const [price, setPrice] = useState('');
  const [priceUnit, setPriceUnit] = useState<'kg' | 'lb'>('kg');
  const [lead, setLead] = useState('');
  const [includes, setIncludes] = useState('');
  const [validFrom, setValidFrom] = useState(todayInput());
  const [errors, setErrors] = useState<FieldErrors>({});

  const material = db.materials.find((m) => m.id === materialId)!;
  const supplier = db.suppliers.find((s) => s.id === supplierId);
  const origin = supplierId === NEW_SUPPLIER ? newSupplier.origin : supplier?.origin;
  const activeSuppliers = db.suppliers.filter((s) => s.active !== false);

  const chooseSupplier = (id: string) => {
    setSupplierId(id);
    setErrors({});
    const last = [...db.supplierPrices].reverse().find((p) => p.supplierId === id && p.materialId === materialId);
    const o = db.suppliers.find((s) => s.id === id)?.origin;
    setLead(last?.leadTimeDays !== undefined ? String(last.leadTimeDays) : '');
    setIncludes(last?.includes ?? (o === 'imported' ? 'Producto y flete' : o ? 'Transporte; IVA aparte' : ''));
  };

  const save = () => {
    let sid = supplierId;
    if (supplierId === NEW_SUPPLIER) {
      const created = saveSupplier(newSupplier);
      if (!created.ok) {
        setErrors(created.errors);
        return;
      }
      sid = created.value;
      setSupplierId(sid);
    }
    const result = saveSupplierPrice({
      materialId,
      supplierId: sid,
      price: parseNumber(price),
      priceUnit: material.unit === 'kg' ? priceUnit : undefined,
      leadTimeDays: lead.trim() === '' ? undefined : parseNumber(lead),
      includes,
      validFrom: parseDateInput(validFrom),
    });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    showToast('success', `Precio registrado para ${material.code}. Facturas y datos de Dobra no cambian.`);
    onClose();
  };

  return (
    <Dialog
      visible
      title="Registrar precio"
      onClose={onClose}
      actions={
        <>
          <Button title="Cancelar" variant="secondary" onPress={onClose} />
          <Button title="Guardar precio" onPress={save} testID="save-price" />
        </>
      }
    >
      <SelectField label="Materia prima" value={materialId} options={db.materials.filter((m) => m.active).map((m) => ({ value: m.id, label: `${m.code} · ${m.name}` }))} onChange={setMaterialId} error={errors.materialId} />
      <SelectField
        label="Proveedor"
        value={supplierId}
        placeholder="Elija el proveedor"
        options={[
          ...activeSuppliers.map((s) => ({ value: s.id, label: s.name, detail: originLabels[s.origin] })),
          { value: NEW_SUPPLIER, label: '+ Nuevo proveedor' },
        ]}
        onChange={chooseSupplier}
        error={errors.supplierId}
        testID="price-supplier"
      />
      {supplierId === NEW_SUPPLIER && (
        <View style={styles.newSupplier}>
          <TextField label="Nombre del proveedor" value={newSupplier.name} onChangeText={(name) => setNewSupplier((s) => ({ ...s, name }))} error={errors.supplierName} />
          <SelectField
            label="Origen"
            value={newSupplier.origin}
            placeholder="Local o importado"
            options={[
              { value: 'local' as Origin, label: 'Local' },
              { value: 'imported' as Origin, label: 'Importado' },
            ]}
            onChange={(o) => {
              setNewSupplier((s) => ({ ...s, origin: o }));
              setIncludes(o === 'imported' ? 'Producto y flete' : 'Transporte; IVA aparte');
            }}
            error={errors.origin}
          />
          <TextField label="Contacto (opcional)" value={newSupplier.contact} onChangeText={(contact) => setNewSupplier((s) => ({ ...s, contact }))} />
        </View>
      )}
      <View style={styles.twoCols}>
        <View style={{ flex: 1 }}>
          <TextField label="Precio (USD)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" error={errors.price} placeholder="0,00" testID="price-value" />
        </View>
        {material.unit === 'kg' && (
          <View style={{ flex: 1 }}>
            <SelectField
              label="Por"
              value={priceUnit}
              options={[
                { value: 'kg', label: 'kilogramo' },
                { value: 'lb', label: 'libra (se convierte a kg)' },
              ]}
              onChange={setPriceUnit}
            />
          </View>
        )}
      </View>
      <View style={styles.twoCols}>
        <View style={{ flex: 1 }}>
          <TextField
            label="Plazo de llegada (días)"
            value={lead}
            onChangeText={setLead}
            keyboardType="number-pad"
            error={errors.leadTimeDays}
            hint={origin === 'imported' ? 'Obligatorio en precios importados.' : undefined}
            testID="price-lead"
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Vigente desde" value={validFrom} onChangeText={setValidFrom} placeholder="dd/mm/aaaa" error={errors.validFrom} hint="Fecha de la factura de compra." />
        </View>
      </View>
      <TextField label="Qué incluye el precio" value={includes} onChangeText={setIncludes} error={errors.includes} hint="Importado: producto y flete. Local: transporte e impuestos." />
    </Dialog>
  );
}

const styles = StyleSheet.create({
  selector: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.lg, flexWrap: 'wrap' },
  selectorHint: { fontSize: 13, color: colors.textMuted, paddingBottom: 11, flexShrink: 1 },
  num: { fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'], textAlign: 'right' },
  bold: { fontWeight: font.weight.semibold },
  bullet: { fontSize: 15, color: colors.text, lineHeight: 22 },
  body: { fontSize: 15, color: colors.text, lineHeight: 22 },
  muted: { fontSize: 14, color: colors.textMuted },
  historyRow: { flexDirection: 'row', gap: spacing.lg, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  historyDate: { fontSize: 14, color: colors.text, width: 100 },
  historyPrice: { fontSize: 14, color: colors.text, fontWeight: font.weight.semibold, width: 120 },
  newSupplier: { gap: spacing.md, padding: spacing.md, backgroundColor: colors.page, borderRadius: 8 },
  twoCols: { flexDirection: 'row', gap: spacing.md },
});
