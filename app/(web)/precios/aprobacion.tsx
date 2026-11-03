// W-17 Aprobación de precios (RF-37, RF-38, RF-04). Below-minimum proposals need a justification.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { StatusBadge } from '@/components/StatusBadge';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { DataTable } from '@/components/web/DataTable';
import { Card, Col, EmptyState, Field, Note, Page, Row } from '@/components/web/Page';
import { priceProposalStatusLabels } from '@/domain/labels';
import { belowMinimum, currentReferencePrice } from '@/domain/pricing';
import type { PriceProposal } from '@/domain/types';
import { formatDateTime, formatNumber, formatPercent, formatUnitCost } from '@/format';
import { approveProposal, rejectProposal } from '@/store/actions';
import { useDataStore } from '@/store/data';
import { userName } from '@/store/selectors';
import { colors, font, spacing } from '@/theme';

export default function PriceApprovalScreen() {
  const db = useDataStore((s) => s.db);
  const [selectedId, setSelectedId] = useState<string>();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const proposals = db.priceProposals.filter((p) => p.status === 'proposed').sort((a, b) => a.proposedAt.localeCompare(b.proposedAt));
  const selected = proposals.find((p) => p.id === selectedId) ?? proposals[0];
  const lineOf = (p: PriceProposal) => db.productLines.find((l) => l.id === db.products.find((x) => x.id === p.productId)!.lineId)!;
  const isBelow = (p: PriceProposal) => belowMinimum(p.margin, lineOf(p).minMargin);

  const approve = () => {
    const r = approveProposal(selected.id, text);
    if (!r.ok) return setError(r.errors.justification);
    showToast('success', `Precio ${formatUnitCost(selected.price)} aprobado: ya es el precio referencial vigente`);
    setText('');
  };
  const reject = () => {
    const r = rejectProposal(selected.id, text);
    if (!r.ok) return setError('Ingrese el motivo del rechazo');
    showToast('success', 'Propuesta rechazada');
    setText('');
  };

  const product = selected && db.products.find((p) => p.id === selected.productId)!;
  const history = selected ? db.priceProposals.filter((p) => p.productId === selected.productId && p.status !== 'proposed').sort((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? '')) : [];
  const vigente = selected && currentReferencePrice(db.priceProposals, selected.productId);

  return (
    <Page>
      <Row>
        <Col minWidth={520} flex={1.4}>
          <Card title="Propuestas de precio referencial" subtitle={`${proposals.length} pendientes`} padded={false}>
            <DataTable
              rows={proposals}
              rowKey={(p) => p.id}
              selectedKey={selected?.id}
              onRowPress={(p) => {
                setSelectedId(p.id);
                setText('');
                setError('');
              }}
              emptyText="No hay propuestas pendientes."
              highlight={(p) => (isBelow(p) ? 'alert' : undefined)}
              columns={[
                { key: 'f', title: 'Funda', flex: 0.8, render: (p) => db.products.find((x) => x.id === p.productId)!.code },
                { key: 'p', title: 'Precio', align: 'right', render: (p) => formatUnitCost(p.price) },
                { key: 'm', title: 'Margen', align: 'right', flex: 0.7, render: (p) => formatPercent(p.margin) },
                { key: 'min', title: 'Mínimo', align: 'right', flex: 0.7, render: (p) => formatPercent(lineOf(p).minMargin, 0) },
                { key: 'b', title: '', flex: 1, render: (p) => (isBelow(p) ? <StatusBadge label="Bajo el mínimo" tone="alert" /> : null) },
              ]}
            />
          </Card>
        </Col>
        <Col minWidth={420} flex={1.2}>
          {selected && product ? (
            <>
              <Card title={`${product.code} · ${product.name}`} subtitle={`Propuesto por ${userName(db, selected.proposedBy)} el ${formatDateTime(selected.proposedAt)}`}>
                <Row gap={spacing.xl}>
                  <Field label="Costo base" value={formatUnitCost(selected.baseUnitCost)} />
                  <Field label="Margen" value={formatPercent(selected.margin)} />
                  <Field label="Método" value={selected.method === 'onCost' ? 'Sobre costo' : 'Sobre precio'} />
                  {selected.quantity && <Field label="Pedido de referencia" value={`${formatNumber(selected.quantity)} u`} />}
                </Row>
                <Text style={styles.price}>{formatUnitCost(selected.price)}</Text>
                <Text style={styles.muted}>Precio vigente actual: {vigente ? formatUnitCost(vigente.price) : 'sin precio aprobado'}</Text>
                {isBelow(selected) && <Note tone="alert">El margen ({formatPercent(selected.margin)}) está bajo el mínimo de la línea {lineOf(selected).name} ({formatPercent(lineOf(selected).minMargin, 0)}). Para aprobarlo debe ingresar la justificación.</Note>}
                <TextField
                  label={isBelow(selected) ? 'Justificación (obligatoria)' : 'Justificación o motivo de rechazo'}
                  value={text}
                  onChangeText={(t) => {
                    setText(t);
                    setError('');
                  }}
                  error={error}
                  multiline
                  testID="justification"
                />
                <View style={styles.actions}>
                  <Button title="Rechazar" variant="secondary" onPress={reject} testID="reject-price" />
                  <Button title="Aprobar" variant="success" icon="check" onPress={approve} testID="approve-price" />
                </View>
              </Card>
              <Card title="Historial de precios de la funda" padded={false}>
                <DataTable
                  rows={history}
                  rowKey={(p) => p.id}
                  emptyText="Sin precios anteriores."
                  columns={[
                    { key: 'p', title: 'Precio', align: 'right', render: (p) => formatUnitCost(p.price) },
                    { key: 'm', title: 'Margen', align: 'right', flex: 0.7, render: (p) => formatPercent(p.margin) },
                    { key: 's', title: 'Estado', render: (p) => <StatusBadge label={vigente?.id === p.id ? 'Vigente' : priceProposalStatusLabels[p.status]} tone={vigente?.id === p.id ? 'success' : p.status === 'rejected' ? 'alert' : 'neutral'} /> },
                    { key: 'd', title: 'Fecha', flex: 1.2, render: (p) => (p.decidedAt ? formatDateTime(p.decidedAt) : '—') },
                  ]}
                />
              </Card>
            </>
          ) : (
            <Card>
              <EmptyState text="No hay propuestas por aprobar." />
            </Card>
          )}
        </Col>
      </Row>
    </Page>
  );
}

const styles = StyleSheet.create({
  price: { fontSize: 36, fontWeight: font.weight.bold, color: colors.primary },
  muted: { fontSize: font.size.sm, color: colors.textMuted },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
