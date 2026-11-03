// W-07 Pedidos (RF-09, RF-10, RF-13). Orders in units converted to weight for extrusion.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Checkbox, SelectField } from '@/components/Inputs';
import { StatusBadge } from '@/components/StatusBadge';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { DataTable } from '@/components/web/DataTable';
import { Card, Col, Note, Page, Row } from '@/components/web/Page';
import { unitsToWeight } from '@/domain/conversion';
import { productTypeLabels, salesOrderStatusLabels } from '@/domain/labels';
import { can } from '@/domain/permissions';
import { formatDate, formatKg, formatLb, formatNumber, parseDateInput, parseNumber, todayInput } from '@/format';
import { go } from '@/navigation/go';
import { cancelSalesOrder, saveSalesOrder } from '@/store/actions';
import { useDataStore } from '@/store/data';
import { useCurrentUser } from '@/store/session';
import { colors, font, radius, spacing } from '@/theme';

const EMPTY = { customerId: undefined as string | undefined, productId: undefined as string | undefined, quantity: '', dueDate: todayInput(14), isService: false, receivedKg: '' };

export default function SalesOrdersScreen() {
  const user = useCurrentUser()!;
  const db = useDataStore((s) => s.db);
  const canEdit = can(user.role, 'salesOrders', 'full');
  const canPlan = user.role === 'sup';
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** Updates fields and clears their errors (the received kg field reports as receivedMaterialKg). */
  const set = (patch: Partial<typeof EMPTY>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const key of Object.keys(patch)) delete next[key === 'receivedKg' ? 'receivedMaterialKg' : key];
      return next;
    });
  };

  const product = db.products.find((p) => p.id === form.productId);
  const quantity = parseNumber(form.quantity);
  const weight = product && quantity > 0 && product.weightG > 0 ? unitsToWeight(quantity, product.weightG) : undefined;

  const save = () => {
    const r = saveSalesOrder({
      customerId: form.customerId,
      productId: form.productId,
      quantity,
      dueDate: parseDateInput(form.dueDate),
      isService: form.isService,
      receivedMaterialKg: form.isService ? parseNumber(form.receivedKg) : undefined,
    });
    if (!r.ok) {
      setErrors(r.errors);
      return showToast('error', 'Revise los campos marcados');
    }
    const code = useDataStore.getState().db.salesOrders.find((s) => s.id === r.value)!.code;
    showToast('success', `Pedido ${code} guardado como Pendiente`);
    setForm(EMPTY);
  };

  const rows = [...db.salesOrders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const tone = { pending: 'warning', ordered: 'success', cancelled: 'alert' } as const;

  return (
    <Page>
      <Row>
        <Col minWidth={620} flex={2}>
          <Card title="Pedidos" subtitle={`${rows.filter((r) => r.status === 'pending').length} pendientes de orden`} padded={false}>
            <DataTable
              rows={rows}
              rowKey={(s) => s.id}
              testID="sales-orders"
              columns={[
                { key: 'code', title: 'Pedido', flex: 0.7, render: (s) => s.code },
                { key: 'customer', title: 'Cliente', flex: 1.3, render: (s) => db.customers.find((c) => c.id === s.customerId)!.name },
                { key: 'product', title: 'Funda', flex: 0.7, render: (s) => db.products.find((p) => p.id === s.productId)!.code },
                { key: 'qty', title: 'Cantidad', align: 'right', flex: 0.7, render: (s) => formatNumber(s.quantity) },
                { key: 'kg', title: 'Peso', align: 'right', flex: 0.7, render: (s) => formatKg(unitsToWeight(s.quantity, db.products.find((p) => p.id === s.productId)!.weightG).kg) },
                { key: 'due', title: 'Entrega', flex: 0.7, render: (s) => formatDate(s.dueDate) },
                { key: 'svc', title: 'Tipo', flex: 0.7, render: (s) => (s.isService ? 'Servicio' : 'Propio') },
                { key: 'st', title: 'Estado', flex: 0.8, render: (s) => <StatusBadge label={salesOrderStatusLabels[s.status]} tone={tone[s.status]} /> },
                {
                  key: 'act',
                  title: '',
                  flex: 1,
                  minWidth: 150,
                  render: (s) =>
                    s.status !== 'pending' ? null : canPlan ? (
                      <Button title="Generar orden" variant="ghost" onPress={() => go(`/ordenes/nueva?pedido=${s.id}`)} testID={`plan-${s.code}`} />
                    ) : canEdit ? (
                      <Button title="Anular" variant="ghost" onPress={() => { cancelSalesOrder(s.id); showToast('success', `${s.code} anulado`); }} />
                    ) : null,
                },
              ]}
            />
          </Card>
        </Col>

        {canEdit && (
          <Col minWidth={360}>
            <Card title="Nuevo pedido">
              <SelectField label="Cliente" value={form.customerId} onChange={(v) => set({ customerId: v })} options={db.customers.map((c) => ({ value: c.id, label: c.name, detail: `RUC ${c.ruc}` }))} error={errors.customerId} testID="customer" />
              <SelectField
                label="Funda"
                value={form.productId}
                onChange={(v) => set({ productId: v })}
                options={db.products.filter((p) => p.active).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}`, detail: `${productTypeLabels[p.type]} · ${formatNumber(p.weightG, 1)} g por unidad` }))}
                error={errors.productId}
                testID="product"
              />
              <TextField label="Cantidad (unidades)" value={form.quantity} onChangeText={(t) => set({ quantity: t })} keyboardType="numeric" error={errors.quantity} placeholder="10.000" testID="quantity" />
              <TextField label="Fecha de entrega" value={form.dueDate} onChangeText={(t) => set({ dueDate: t })} error={errors.dueDate} placeholder="dd/mm/aaaa" testID="due-date" />
              <Checkbox label="Servicio a terceros (el cliente entrega la materia prima)" checked={form.isService} onChange={(v) => set({ isService: v })} testID="is-service" />
              {form.isService && <TextField label="Materia prima recibida (kg)" value={form.receivedKg} onChangeText={(t) => set({ receivedKg: t })} keyboardType="numeric" error={errors.receivedMaterialKg} testID="received-kg" />}

              <View style={styles.conversion} testID="conversion">
                <Text style={styles.convLabel}>Peso a producir</Text>
                {weight ? (
                  <View style={styles.convRow}>
                    <Text style={styles.convValue}>{formatKg(weight.kg)}</Text>
                    <Text style={styles.convAlt}>{formatLb(weight.lb)}</Text>
                  </View>
                ) : (
                  <Text style={styles.convHint}>Seleccione la funda e ingrese la cantidad</Text>
                )}
                {weight && product && (
                  <Text style={styles.convHint}>
                    {formatNumber(quantity)} × {formatNumber(product.weightG, 1)} g ÷ 1.000
                  </Text>
                )}
              </View>
              {product && product.weightG <= 0 && <Note tone="alert">La funda no tiene peso por unidad: no se puede generar la orden.</Note>}
              <Button title="Guardar pedido" onPress={save} testID="save-order" />
            </Card>
          </Col>
        )}
      </Row>
    </Page>
  );
}

const styles = StyleSheet.create({
  conversion: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.xs },
  convLabel: { fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.textMuted },
  convRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.lg, flexWrap: 'wrap' },
  convValue: { fontSize: 30, fontWeight: font.weight.bold, color: colors.primary, fontVariant: ['tabular-nums'] },
  convAlt: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.text, fontVariant: ['tabular-nums'] },
  convHint: { fontSize: font.size.sm, color: colors.textMuted },
});
