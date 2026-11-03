// W-05 Recetas (BOM) (RF-07). Recipe per kg of product; editing an approved recipe creates a new version.
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { SelectField } from '@/components/Inputs';
import { StatusBadge } from '@/components/StatusBadge';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { DataTable } from '@/components/web/DataTable';
import { Card, Col, Note, Page, Row } from '@/components/web/Page';
import { currentRecipe } from '@/domain/costing';
import { materialUnitLabels, recipeStatusLabels } from '@/domain/labels';
import { can } from '@/domain/permissions';
import { referencePrice } from '@/domain/prices';
import type { RecipeStatus } from '@/domain/types';
import { formatDateTime, formatMoney, formatNumber, parseNumber } from '@/format';
import { go } from '@/navigation/go';
import { saveRecipeDraft } from '@/store/actions';
import { useDataStore } from '@/store/data';
import { userName } from '@/store/selectors';
import { useCurrentUser } from '@/store/session';
import { colors, font, radius, spacing } from '@/theme';

type Row = { key: number; materialId?: string; qty: string };
const STATUS_TONE: Record<RecipeStatus, 'warning' | 'success' | 'alert'> = { draft: 'warning', approved: 'success', rejected: 'alert' };
let rowSeq = 0;

export default function RecipeScreen() {
  const { funda } = useLocalSearchParams<{ funda: string }>();
  const user = useCurrentUser()!;
  const db = useDataStore((s) => s.db);
  const canEdit = can(user.role, 'catalog', 'full');
  const product = db.products.find((p) => p.id === funda) ?? db.products[0];
  const recipes = db.recipes.filter((r) => r.productId === product.id).sort((a, b) => b.version - a.version);
  const approved = currentRecipe(db, product.id);
  const draft = recipes.find((r) => r.status === 'draft');
  const base = draft ?? approved;

  const toRows = () => (base?.items ?? []).map((i) => ({ key: ++rowSeq, materialId: i.materialId, qty: formatNumber(i.qtyPerKg, 3) }));
  const [rows, setRows] = useState<Row[]>(toRows);
  const [error, setError] = useState('');
  // Reload the table when switching product or when a new version is saved.
  useEffect(() => {
    setRows(toRows());
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, base?.id, base?.createdAt]);

  const now = new Date().toISOString();
  const priceOf = (materialId?: string) => (materialId ? referencePrice(db.supplierPrices, db.suppliers, materialId, now) : 0);
  const costPerKg = rows.reduce((t, r) => t + (parseNumber(r.qty) || 0) * priceOf(r.materialId), 0);
  const usable = db.materials.filter((m) => m.active);

  const update = (key: number, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setError('');
  };
  const submit = () => {
    const r = saveRecipeDraft(product.id, rows.map((x) => ({ materialId: x.materialId ?? '', qtyPerKg: parseNumber(x.qty) })));
    if (!r.ok) {
      setError(r.errors.items);
      return showToast('error', r.errors.items);
    }
    const saved = useDataStore.getState().db.recipes.find((x) => x.id === r.value)!;
    showToast('success', `Receta ${product.code} v${saved.version} enviada a aprobación (Borrador)`);
  };

  return (
    <Page>
      <Row align="flex-end">
        <View style={{ width: 420 }}>
          <SelectField label="Funda" value={product.id} onChange={(v) => go(`/recetas/${v}`)} options={db.products.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))} testID="recipe-product" />
        </View>
        {approved && <StatusBadge label={`v${approved.version} aprobada vigente`} tone="success" large />}
        {draft && <StatusBadge label={`v${draft.version} en borrador`} tone="warning" large />}
      </Row>

      <Row>
        <Col minWidth={560} flex={1.6}>
          <Card title={draft ? `Borrador v${draft.version}` : approved ? `Editar receta (se creará la v${(recipes[0]?.version ?? 0) + 1})` : 'Nueva receta'} subtitle="Cantidades por kilogramo de producto">
            {draft && <Note tone="warning">Hay una versión en borrador pendiente de aprobación; al enviar se actualiza ese borrador.</Note>}
            {!draft && approved && canEdit && <Note tone="info">La receta aprobada no se modifica: al enviar se crea una versión nueva y la anterior queda en el historial.</Note>}
            <View style={styles.headRow}>
              <Text style={[styles.head, { flex: 2.2 }]}>Insumo</Text>
              <Text style={[styles.head, { flex: 1 }]}>Cantidad por kg</Text>
              <Text style={[styles.head, { flex: 0.6 }]}>Unidad</Text>
              <Text style={[styles.head, styles.right, { flex: 0.9 }]}>Costo por kg</Text>
              {canEdit && <View style={{ width: 92 }} />}
            </View>
            {rows.map((r, i) => {
              const m = db.materials.find((x) => x.id === r.materialId);
              return (
                <View key={r.key} style={styles.row} testID={`recipe-row-${i}`}>
                  <View style={{ flex: 2.2 }}>
                    {canEdit ? (
                      <SelectField label="" value={r.materialId} onChange={(v) => update(r.key, { materialId: v })} options={usable.map((x) => ({ value: x.id, label: `${x.code} · ${x.name}` }))} testID={`recipe-material-${i}`} />
                    ) : (
                      <Text style={styles.cell}>{m ? `${m.code} · ${m.name}` : '—'}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    {canEdit ? <TextField label="" value={r.qty} onChangeText={(t) => update(r.key, { qty: t })} keyboardType="decimal-pad" testID={`recipe-qty-${i}`} /> : <Text style={styles.cell}>{r.qty}</Text>}
                  </View>
                  <Text style={[styles.cell, { flex: 0.6 }]}>{m ? materialUnitLabels[m.unit] : ''}</Text>
                  <Text style={[styles.cell, styles.right, { flex: 0.9 }]}>{formatMoney((parseNumber(r.qty) || 0) * priceOf(r.materialId))}</Text>
                  {canEdit && <Button title="Quitar" variant="ghost" onPress={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} />}
                </View>
              );
            })}
            {!!error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.total}>
              <Text style={styles.totalLabel}>Costo estándar estimado de materiales por kg (precios vigentes)</Text>
              <Text style={styles.totalValue} testID="cost-per-kg">
                {formatMoney(costPerKg)}
              </Text>
            </View>
            {canEdit && (
              <Row>
                <Button title="Agregar insumo" icon="plus" variant="secondary" onPress={() => setRows((rs) => [...rs, { key: ++rowSeq, qty: '' }])} testID="add-row" />
                <Button title="Enviar a aprobación" onPress={submit} testID="submit-recipe" />
              </Row>
            )}
          </Card>
        </Col>
        <Col minWidth={360}>
          <Card title="Historial de versiones" padded={false}>
            <DataTable
              rows={recipes}
              rowKey={(r) => r.id}
              columns={[
                { key: 'v', title: 'Versión', flex: 0.5, render: (r) => `v${r.version}` },
                { key: 's', title: 'Estado', flex: 0.9, render: (r) => <StatusBadge label={recipeStatusLabels[r.status]} tone={STATUS_TONE[r.status]} /> },
                { key: 'd', title: 'Fecha', flex: 1.1, render: (r) => formatDateTime(r.decidedAt ?? r.createdAt) },
                { key: 'u', title: 'Por', flex: 1, render: (r) => userName(db, r.decidedBy ?? r.createdBy) },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </Page>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', gap: spacing.md, paddingBottom: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  head: { fontSize: 12, fontWeight: font.weight.bold, color: colors.textMuted, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cell: { fontSize: font.size.sm + 1, color: colors.text },
  right: { textAlign: 'right' },
  error: { color: colors.alert, fontSize: font.size.sm },
  total: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.md },
  totalLabel: { flex: 1, fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.textMuted },
  totalValue: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.primary },
});
