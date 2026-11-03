// W-09 Detalle y validación de orden (RF-15, RF-16, RF-17, RF-19, RF-20, RF-22).
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { OrderStatusBadge } from '@/components/StatusBadge';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { DataTable } from '@/components/web/DataTable';
import { Card, Col, Field, Note, Page, Row } from '@/components/web/Page';
import { stageLabels, stageStatusLabels, wasteDestinationLabels } from '@/domain/labels';
import { orderWaste, sumBreakdowns, timeBreakdown } from '@/domain/production';
import type { TimeEntry } from '@/domain/types';
import { formatDate, formatDateTime, formatDuration, formatKg, formatNumber, formatPercent, formatTime } from '@/format';
import { useNow } from '@/hooks/useNow';
import { go } from '@/navigation/go';
import { correctTimeEntry, returnOrder, validateOrder } from '@/store/actions';
import { useDataStore } from '@/store/data';
import { machineCode, orderInfo, userName } from '@/store/selectors';
import { colors, font, radius, spacing } from '@/theme';

/** Replaces the HH:MM of an ISO timestamp, keeping its date (local time). */
function withTime(iso: string, hhmm: string): string | undefined {
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return undefined;
  const d = new Date(iso);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d.toISOString();
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDataStore((s) => s.db);
  const now = useNow(10_000);
  const [returning, setReturning] = useState(false);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [editing, setEditing] = useState<TimeEntry>();
  const [edit, setEdit] = useState({ start: '', end: '', reason: '' });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const info = orderInfo(db, id);
  if (!info) {
    return (
      <Page>
        <Note tone="alert">No se encontró la orden.</Note>
      </Page>
    );
  }
  const { order, product, customer, salesOrder, recipe, stages } = info;
  const waste = orderWaste(db, order.id);
  const stageIds = new Set(stages.map((s) => s.id));
  const entries = db.timeEntries.filter((t) => stageIds.has(t.stageId)).sort((a, b) => a.start.localeCompare(b.start));
  const records = db.productionRecords.filter((r) => stageIds.has(r.stageId));
  const wastes = db.wasteRecords.filter((w) => stageIds.has(w.stageId));
  const totals = sumBreakdowns(entries.map((e) => timeBreakdown(e, now)));
  const stageType = (stageId: string) => stages.find((s) => s.id === stageId)!.type;

  const validate = () => {
    const r = validateOrder(order.id);
    if (!r.ok) return showToast('error', Object.values(r.errors)[0]);
    showToast('success', `${order.code} cerrada. Costo calculado.`);
    go(`/costos/ordenes/${order.id}`);
  };
  const giveBack = () => {
    const r = returnOrder(order.id, note);
    if (!r.ok) return setNoteError(r.errors.note ?? Object.values(r.errors)[0]);
    setReturning(false);
    setNote('');
    showToast('success', `${order.code} devuelta a planta; se avisó a los operarios`);
  };
  const openEdit = (e: TimeEntry) => {
    setEditing(e);
    setEdit({ start: formatTime(e.start), end: e.end ? formatTime(e.end) : '', reason: '' });
    setEditErrors({});
  };
  const saveEdit = () => {
    if (!editing) return;
    const start = withTime(editing.start, edit.start);
    const end = withTime(editing.end ?? editing.start, edit.end);
    if (!start || !end) return setEditErrors({ [!start ? 'start' : 'end']: 'Use el formato HH:MM' });
    const r = correctTimeEntry(editing.id, start, end, edit.reason);
    if (!r.ok) return setEditErrors(r.errors);
    setEditing(undefined);
    showToast('success', 'Marcación corregida y registrada en la bitácora');
  };

  return (
    <Page>
      <Card>
        <Row align="center">
          <Text style={styles.code}>{order.code}</Text>
          <OrderStatusBadge status={order.status} large />
          {salesOrder.isService && <Text style={styles.service}>Servicio a terceros</Text>}
          <View style={{ flex: 1 }} />
          {order.status === 'toValidate' && (
            <>
              <Button title="Devolver con observación" variant="secondary" onPress={() => setReturning(true)} testID="return-order" />
              <Button title="Validar cierre" variant="success" icon="check" onPress={validate} testID="validate-order" />
            </>
          )}
          {order.status === 'closed' && <Button title="Ver costeo de la orden" onPress={() => go(`/costos/ordenes/${order.id}`)} testID="see-cost" />}
        </Row>
        <Row gap={spacing.xl}>
          <Field label="Funda" value={`${product.code} · ${product.name}`} />
          <Field label="Cliente" value={customer.name} />
          <Field label="Pedido" value={`${salesOrder.code} · ${formatNumber(salesOrder.quantity)} u`} />
          <Field label="Peso a producir" value={formatKg(order.weightKg)} />
          <Field label="Receta" value={`v${recipe.version} aprobada`} />
          <Field label="Entrega" value={formatDate(salesOrder.dueDate)} />
        </Row>
        {order.returnNote && order.status === 'inProgress' && <Note tone="warning">Devuelta a planta: {order.returnNote}</Note>}
      </Card>

      <Card title="Etapas">
        <View style={styles.timeline}>
          {stages.map((s, i) => {
            const color = s.status === 'done' ? colors.success : s.status === 'inProgress' ? colors.primary : colors.idle;
            return (
              <View key={s.id} style={styles.step}>
                <View style={styles.stepLine}>
                  <View style={[styles.dot, { backgroundColor: color }]}>
                    <Text style={styles.dotText}>{s.sequence}</Text>
                  </View>
                  {i < stages.length - 1 && <View style={[styles.bar, { backgroundColor: s.status === 'done' ? colors.success : colors.border }]} />}
                </View>
                <Text style={styles.stepTitle}>{stageLabels[s.type]}</Text>
                <Text style={styles.stepMeta}>{stageStatusLabels[s.status]}</Text>
                <Text style={styles.stepMeta}>
                  {s.machineId ? machineCode(db, s.machineId) : 'Manual'} · {s.operatorIds.map((u) => userName(db, u).split(' ')[0]).join(', ')}
                </Text>
              </View>
            );
          })}
        </View>
      </Card>

      <Row>
        <Col minWidth={260}>
          <Card title="Merma de la orden">
            <Text style={[styles.waste, { color: waste.alert ? colors.alert : colors.success }]} testID="waste-percent">
              {formatPercent(waste.fraction)}
            </Text>
            <Text style={styles.muted}>
              {formatKg(waste.wasteKg)} sobre {formatKg(waste.rawKg)} de materia prima usada
            </Text>
            {waste.alert ? (
              <Note tone="alert">Supera el máximo configurado de {formatPercent(db.settings.maxWastePct, 0)}. Se notificó al supervisor.</Note>
            ) : (
              <Note tone="success">Dentro del máximo de {formatPercent(db.settings.maxWastePct, 0)}.</Note>
            )}
          </Card>
        </Col>
        <Col minWidth={260}>
          <Card title="Tiempos">
            <Field label="Tiempo efectivo" value={formatDuration(totals.effectiveMs)} />
            <Field label="Pausas activas" value={formatDuration(totals.activePauseMs)} />
            <Field label="Descansos" value={formatDuration(totals.restMs)} />
          </Card>
        </Col>
        <Col minWidth={260}>
          <Card title="Cierre en empacado">
            {order.finalCount !== undefined ? (
              <>
                <Field label="Conteo final" value={`${formatNumber(order.finalCount)} u (pedido ${formatNumber(salesOrder.quantity)})`} />
                <Field label="Bultos" value={String(order.bundles)} />
                <Field label="Cerrada en planta" value={order.packedAt ? formatDateTime(order.packedAt) : '—'} />
              </>
            ) : (
              <Text style={styles.muted}>Aún no se cierra en empacado.</Text>
            )}
          </Card>
        </Col>
      </Row>

      <Card title="Registros de producción" padded={false}>
        <DataTable
          rows={records}
          rowKey={(r) => r.id}
          emptyText="Sin registros de producción."
          columns={[
            { key: 'stage', title: 'Etapa', render: (r) => stageLabels[stageType(r.stageId)] },
            { key: 'op', title: 'Operario', render: (r) => userName(db, r.operatorId) },
            { key: 'mc', title: 'Máquina', flex: 0.6, render: (r) => machineCode(db, r.machineId) },
            { key: 'raw', title: 'MP usada', align: 'right', flex: 0.7, render: (r) => (r.rawMaterialKg ? formatKg(r.rawMaterialKg) : '—') },
            { key: 'roll', title: 'Rollo', align: 'right', flex: 0.7, render: (r) => (r.rollKg ? formatKg(r.rollKg) : '—') },
            { key: 'units', title: 'Unidades', align: 'right', flex: 0.7, render: (r) => (r.units ? formatNumber(r.units) : '—') },
            { key: 'at', title: 'Fecha', render: (r) => formatDateTime(r.at) },
          ]}
        />
      </Card>

      <Card title="Mermas" padded={false}>
        <DataTable
          rows={wastes}
          rowKey={(w) => w.id}
          emptyText="Sin mermas registradas."
          columns={[
            { key: 'stage', title: 'Etapa', render: (w) => stageLabels[stageType(w.stageId)] },
            { key: 'op', title: 'Operario', render: (w) => userName(db, w.operatorId) },
            { key: 'kg', title: 'Kg', align: 'right', flex: 0.6, render: (w) => formatKg(w.kg) },
            { key: 'dest', title: 'Destino', render: (w) => wasteDestinationLabels[w.destination] },
            { key: 'at', title: 'Fecha', render: (w) => formatDateTime(w.at) },
          ]}
        />
      </Card>

      <Card title="Marcaciones de tiempo" subtitle="El supervisor puede corregir una marcación indicando el motivo (RF-22)" padded={false}>
        <DataTable
          rows={entries}
          rowKey={(e) => e.id}
          emptyText="Sin marcaciones."
          columns={[
            { key: 'stage', title: 'Etapa', flex: 0.8, render: (e) => stageLabels[stageType(e.stageId)] },
            { key: 'op', title: 'Operario', render: (e) => userName(db, e.operatorId) },
            { key: 'span', title: 'Inicio – fin', render: (e) => `${formatDate(e.start)} ${formatTime(e.start)} – ${e.end ? formatTime(e.end) : 'en curso'}` },
            { key: 'eff', title: 'Efectivo', align: 'right', flex: 0.7, render: (e) => formatDuration(timeBreakdown(e, now).effectiveMs) },
            { key: 'act', title: 'Pausas', align: 'right', flex: 0.6, render: (e) => formatDuration(timeBreakdown(e, now).activePauseMs) },
            { key: 'rest', title: 'Descansos', align: 'right', flex: 0.6, render: (e) => formatDuration(timeBreakdown(e, now).restMs) },
            {
              key: 'fix',
              title: '',
              flex: 0.9,
              render: (e) =>
                e.correction ? (
                  <Text style={styles.muted}>Corregida: {e.correction.reason}</Text>
                ) : e.end && order.status !== 'closed' ? (
                  <Button title="Corregir" variant="ghost" onPress={() => openEdit(e)} testID={`fix-${e.id}`} />
                ) : null,
            },
          ]}
        />
      </Card>

      <Dialog
        visible={returning}
        title={`Devolver ${order.code} a planta`}
        onClose={() => setReturning(false)}
        actions={
          <>
            <Button title="Cancelar" variant="ghost" onPress={() => setReturning(false)} />
            <Button title="Devolver" onPress={giveBack} testID="confirm-return" />
          </>
        }
      >
        <Text style={styles.muted}>La orden vuelve a "En proceso" y los operarios reciben el aviso en su celular.</Text>
        <TextField label="Observación" value={note} onChangeText={(t) => { setNote(t); setNoteError(''); }} error={noteError} multiline placeholder="Ej.: recontar los bultos 7 y 8" />
      </Dialog>

      <Dialog
        visible={!!editing}
        title="Corregir marcación"
        onClose={() => setEditing(undefined)}
        actions={
          <>
            <Button title="Cancelar" variant="ghost" onPress={() => setEditing(undefined)} />
            <Button title="Guardar corrección" onPress={saveEdit} testID="save-fix" />
          </>
        }
      >
        {editing && (
          <Text style={styles.muted}>
            {userName(db, editing.operatorId)} · {stageLabels[stageType(editing.stageId)]} · {formatDate(editing.start)}
          </Text>
        )}
        <Row>
          <View style={{ flex: 1 }}>
            <TextField label="Inicio (HH:MM)" value={edit.start} onChangeText={(t) => setEdit((s) => ({ ...s, start: t }))} error={editErrors.start} />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Fin (HH:MM)" value={edit.end} onChangeText={(t) => setEdit((s) => ({ ...s, end: t }))} error={editErrors.end} />
          </View>
        </Row>
        <TextField label="Motivo de la corrección" value={edit.reason} onChangeText={(t) => setEdit((s) => ({ ...s, reason: t }))} error={editErrors.reason} placeholder="Ej.: el operario olvidó marcar la salida" testID="fix-reason" />
      </Dialog>
    </Page>
  );
}

const styles = StyleSheet.create({
  code: { fontSize: font.size.xxl, fontWeight: font.weight.bold, color: colors.primary },
  service: { fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.warning, backgroundColor: colors.warningBg, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.lg },
  muted: { fontSize: font.size.sm, color: colors.textMuted },
  timeline: { flexDirection: 'row', flexWrap: 'wrap' },
  step: { flex: 1, minWidth: 160, gap: 2 },
  stepLine: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dotText: { color: colors.onPrimary, fontWeight: font.weight.bold },
  bar: { flex: 1, height: 3, marginHorizontal: spacing.sm },
  stepTitle: { fontSize: font.size.md, fontWeight: font.weight.bold, color: colors.text },
  stepMeta: { fontSize: font.size.sm, color: colors.textMuted },
  waste: { fontSize: 36, fontWeight: font.weight.bold },
});
