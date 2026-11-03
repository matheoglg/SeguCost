// W-06 Aprobación de recetas (RF-08, RF-04). Draft inbox with the difference against the approved version.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { DataTable } from '@/components/web/DataTable';
import { Card, Col, EmptyState, Note, Page, Row } from '@/components/web/Page';
import { currentRecipe } from '@/domain/costing';
import { materialUnitLabels } from '@/domain/labels';
import { formatDateTime, formatNumber } from '@/format';
import { approveRecipe, rejectRecipe } from '@/store/actions';
import { useDataStore } from '@/store/data';
import { userName } from '@/store/selectors';
import { colors, font, spacing } from '@/theme';

export default function RecipeApprovalScreen() {
  const db = useDataStore((s) => s.db);
  const drafts = db.recipes.filter((r) => r.status === 'draft').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const [selectedId, setSelectedId] = useState<string>();
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const selected = drafts.find((d) => d.id === selectedId) ?? drafts[0];

  if (!selected) {
    return (
      <Page>
        <Card title="Recetas en borrador">
          <EmptyState text="No hay recetas pendientes de aprobación." />
        </Card>
      </Page>
    );
  }

  const product = db.products.find((p) => p.id === selected.productId)!;
  const previous = currentRecipe(db, product.id);
  const materialIds = [...new Set([...selected.items.map((i) => i.materialId), ...(previous?.items.map((i) => i.materialId) ?? [])])];
  const diff = materialIds.map((id) => ({
    id,
    before: previous?.items.find((i) => i.materialId === id)?.qtyPerKg,
    after: selected.items.find((i) => i.materialId === id)?.qtyPerKg,
  }));

  const approve = () => {
    approveRecipe(selected.id);
    showToast('success', `Receta ${product.code} v${selected.version} aprobada y registrada en la bitácora`);
    setReason('');
  };
  const reject = () => {
    const r = rejectRecipe(selected.id, reason);
    if (!r.ok) return setReasonError(r.errors.reason);
    showToast('success', `Receta ${product.code} v${selected.version} rechazada`);
    setReason('');
  };

  return (
    <Page>
      <Row>
        <Col minWidth={320}>
          <Card title="Recetas en borrador" subtitle={`${drafts.length} por revisar`} padded={false}>
            <DataTable
              rows={drafts}
              rowKey={(r) => r.id}
              selectedKey={selected.id}
              onRowPress={(r) => {
                setSelectedId(r.id);
                setReason('');
                setReasonError('');
              }}
              columns={[
                { key: 'p', title: 'Funda', render: (r) => db.products.find((p) => p.id === r.productId)!.code },
                { key: 'v', title: 'Versión', flex: 0.5, render: (r) => `v${r.version}` },
                { key: 'd', title: 'Enviada', flex: 1.2, render: (r) => formatDateTime(r.createdAt) },
              ]}
            />
          </Card>
        </Col>
        <Col minWidth={560} flex={2}>
          <Card title={`${product.code} · ${product.name} · v${selected.version}`} subtitle={`Enviada por ${userName(db, selected.createdBy)} el ${formatDateTime(selected.createdAt)}`} padded={false}>
            <DataTable
              rows={diff}
              rowKey={(d) => d.id}
              highlight={(d) => (d.before !== d.after ? 'success' : undefined)}
              columns={[
                { key: 'm', title: 'Insumo', flex: 2, render: (d) => { const m = db.materials.find((x) => x.id === d.id)!; return `${m.code} · ${m.name}`; } },
                { key: 'b', title: previous ? `v${previous.version} vigente` : 'Anterior', align: 'right', render: (d) => (d.before !== undefined ? formatNumber(d.before, 3) : '—') },
                { key: 'a', title: `v${selected.version} propuesta`, align: 'right', render: (d) => (d.after !== undefined ? formatNumber(d.after, 3) : '—') },
                {
                  key: 'c',
                  title: 'Cambio',
                  align: 'right',
                  render: (d) => {
                    const change = (d.after ?? 0) - (d.before ?? 0);
                    if (!change) return 'Sin cambio';
                    const unit = materialUnitLabels[db.materials.find((x) => x.id === d.id)!.unit];
                    return `${change > 0 ? '+' : '−'}${formatNumber(Math.abs(change), 3)} ${unit}/kg`;
                  },
                },
              ]}
            />
          </Card>
          <Card>
            <Text style={styles.muted}>Al aprobar, la versión queda vigente para las órdenes nuevas y se registra en la bitácora con su usuario, fecha y hora.</Text>
            <TextField label="Motivo (obligatorio al rechazar)" value={reason} onChangeText={(t) => { setReason(t); setReasonError(''); }} error={reasonError} multiline testID="reject-reason" />
            {reasonError ? <Note tone="alert">{reasonError}</Note> : null}
            <View style={styles.actions}>
              <Button title="Rechazar" variant="secondary" onPress={reject} testID="reject-recipe" />
              <Button title="Aprobar" variant="success" icon="check" onPress={approve} testID="approve-recipe" />
            </View>
          </Card>
        </Col>
      </Row>
    </Page>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: font.size.sm, color: colors.textMuted },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
