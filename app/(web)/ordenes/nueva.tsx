// W-08 Órdenes de producción (RF-11, RF-12, RF-20). Route by product type and resources per stage.
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { SelectField } from '@/components/Inputs';
import { showToast } from '@/components/Toast';
import { Card, Col, Field, Note, Page, Row } from '@/components/web/Page';
import { currentRecipe } from '@/domain/costing';
import { unitsToWeight } from '@/domain/conversion';
import { materialUnitLabels, productTypeLabels, sectionLabels, stageLabels } from '@/domain/labels';
import { buildRoute, sectionOf } from '@/domain/routing';
import type { StageType } from '@/domain/types';
import { formatDate, formatKg, formatLb, formatNumber } from '@/format';
import { go } from '@/navigation/go';
import { createOrder, isFullyAssigned, type StageAssignment } from '@/store/actions';
import { useDataStore } from '@/store/data';
import { colors, font, radius, spacing } from '@/theme';

export default function NewOrderScreen() {
  const { pedido } = useLocalSearchParams<{ pedido?: string }>();
  const db = useDataStore((s) => s.db);
  const pending = db.salesOrders.filter((s) => s.status === 'pending');
  const [salesOrderId, setSalesOrderId] = useState<string | undefined>(pedido && pending.some((p) => p.id === pedido) ? pedido : pending[0]?.id);
  const [plan, setPlan] = useState<StageAssignment>({});

  const so = db.salesOrders.find((s) => s.id === salesOrderId);
  const product = so && db.products.find((p) => p.id === so.productId);
  const customer = so && db.customers.find((c) => c.id === so.customerId);
  const recipe = product && currentRecipe(db, product.id);
  const route: StageType[] = product ? buildRoute(product.type) : [];
  const weight = so && product ? unitsToWeight(so.quantity, product.weightG) : undefined;
  const operators = db.users.filter((u) => u.role === 'ope' && u.active);
  const ready = !!recipe && isFullyAssigned(route, plan);

  const setStage = (stage: StageType, patch: Partial<{ machineId: string; operatorIds: string[] }>) =>
    setPlan((p) => ({ ...p, [stage]: { operatorIds: [], ...p[stage], ...patch } }));
  const toggleOperator = (stage: StageType, userId: string) => {
    const current = plan[stage]?.operatorIds ?? [];
    setStage(stage, { operatorIds: current.includes(userId) ? current.filter((u) => u !== userId) : [...current, userId] });
  };

  const release = () => {
    if (!so) return;
    const r = createOrder(so.id, plan);
    if (!r.ok) return showToast('error', Object.values(r.errors)[0]);
    const order = useDataStore.getState().db.orders.find((o) => o.id === r.value)!;
    showToast('success', `${order.code} liberada a planta: los operarios ya la ven en su celular`);
    setPlan({});
    go(`/ordenes/${order.id}`);
  };

  if (!pending.length) {
    return (
      <Page>
        <Note tone="info">No hay pedidos pendientes de orden. Registre uno en Pedidos.</Note>
        <View>
          <Button title="Ir a pedidos" onPress={() => go('/pedidos')} />
        </View>
      </Page>
    );
  }

  return (
    <Page>
      <Row>
        <Col minWidth={360}>
          <Card title="Pedido">
            <SelectField
              label="Pedido pendiente"
              value={salesOrderId}
              onChange={(v) => {
                setSalesOrderId(v);
                setPlan({});
              }}
              options={pending.map((s) => ({ value: s.id, label: `${s.code} · ${db.products.find((p) => p.id === s.productId)!.code} · ${formatNumber(s.quantity)} u`, detail: db.customers.find((c) => c.id === s.customerId)!.name }))}
              testID="sales-order"
            />
            {so && product && (
              <Row gap={spacing.lg}>
                <Field label="Cliente" value={customer!.name} />
                <Field label="Funda" value={`${product.code} · ${productTypeLabels[product.type]}`} />
                <Field label="Cantidad" value={`${formatNumber(so.quantity)} u`} />
                <Field label="Entrega" value={formatDate(so.dueDate)} />
                {so.isService && <Field label="Servicio" value={`Cliente entrega ${formatKg(so.receivedMaterialKg ?? 0)}`} />}
              </Row>
            )}
            {weight && (
              <View style={styles.weight}>
                <Text style={styles.weightLabel}>Peso a producir</Text>
                <Text style={styles.weightValue}>
                  {formatKg(weight.kg)} · {formatLb(weight.lb)}
                </Text>
              </View>
            )}
          </Card>
          <Card title="Receta aprobada vigente">
            {recipe ? (
              <>
                <Text style={styles.muted}>
                  {product!.code} versión {recipe.version} · por kg de producto
                </Text>
                {recipe.items.map((i) => {
                  const m = db.materials.find((x) => x.id === i.materialId)!;
                  return (
                    <View key={i.materialId} style={styles.item}>
                      <Text style={styles.itemText}>
                        {m.code} · {m.name}
                      </Text>
                      <Text style={styles.itemQty}>
                        {formatNumber(i.qtyPerKg, 3)} {materialUnitLabels[m.unit]}
                      </Text>
                    </View>
                  );
                })}
              </>
            ) : (
              <Note tone="alert">La funda no tiene receta aprobada; no se puede generar la orden (RF-08).</Note>
            )}
          </Card>
        </Col>

        <Col minWidth={520} flex={1.6}>
          <Card title="Ruta de etapas y asignación" subtitle="Cada etapa necesita máquina de su sección (salvo empacado) y al menos un operario">
            {route.map((stage, i) => {
              const section = sectionOf(stage);
              const assigned = plan[stage];
              const complete = (assigned?.operatorIds.length ?? 0) > 0 && (!section || !!assigned?.machineId);
              return (
                <View key={stage} style={styles.stage} testID={`stage-${stage}`}>
                  <View style={[styles.num, complete && styles.numDone]}>
                    <Text style={styles.numText}>{i + 1}</Text>
                  </View>
                  <View style={styles.stageBody}>
                    <Text style={styles.stageTitle}>{stageLabels[stage]}</Text>
                    {section ? (
                      <SelectField
                        label={`Máquina de ${sectionLabels[section].toLowerCase()}`}
                        value={assigned?.machineId}
                        onChange={(v) => setStage(stage, { machineId: v })}
                        options={db.machines.filter((m) => m.section === section && m.active).map((m) => ({ value: m.id, label: m.code }))}
                        testID={`machine-${stage}`}
                      />
                    ) : (
                      <Text style={styles.muted}>Etapa manual, sin máquina.</Text>
                    )}
                    <Text style={styles.label}>Operarios</Text>
                    <View style={styles.chips}>
                      {operators.map((u) => {
                        const on = assigned?.operatorIds.includes(u.id);
                        return (
                          <Pressable key={u.id} onPress={() => toggleOperator(stage, u.id)} style={[styles.chip, on && styles.chipOn]} accessibilityRole="checkbox" accessibilityState={{ checked: !!on }} testID={`op-${stage}-${u.username}`}>
                            <Text style={[styles.chipText, on && styles.chipTextOn]}>{u.name}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </View>
              );
            })}
            {!ready && <Text style={styles.muted}>Asigne máquina y operarios a todas las etapas para liberar la orden.</Text>}
            <Button title="Liberar a planta" disabled={!ready} onPress={release} testID="release-order" />
          </Card>
        </Col>
      </Row>
    </Page>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: font.size.sm, color: colors.textMuted },
  weight: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  weightLabel: { fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.textMuted },
  weightValue: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.primary },
  item: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.surface },
  itemText: { fontSize: font.size.sm + 1, color: colors.text },
  itemQty: { fontSize: font.size.sm + 1, fontWeight: font.weight.bold, color: colors.text },
  stage: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.surface },
  num: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.idle, alignItems: 'center', justifyContent: 'center' },
  numDone: { backgroundColor: colors.success },
  numText: { color: colors.onPrimary, fontWeight: font.weight.bold, fontSize: font.size.md },
  stageBody: { flex: 1, gap: spacing.sm },
  stageTitle: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.text },
  label: { fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: font.size.sm, color: colors.text },
  chipTextOn: { color: colors.onPrimary, fontWeight: font.weight.bold },
});
