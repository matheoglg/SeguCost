// W-14 Parámetros de costeo (RF-25, RF-41): rates with validity date and the commercial rules.
// Every change keeps the previous value in history; closed orders keep the values they used.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, LinkButton } from '@/components/Button';
import { SelectField, Tabs } from '@/components/Inputs';
import { StatusBadge } from '@/components/StatusBadge';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { DataTable, type Column } from '@/components/web/DataTable';
import { Card, Col, Note, Page, Row } from '@/components/web/Page';
import { sectionLabels } from '@/domain/labels';
import { dateKey, inForce } from '@/domain/prices';
import type { RuleKey } from '@/domain/types';
import type { FieldErrors } from '@/domain/validation';
import { formatDate, formatNumber, formatPercent, parseDateInput, parseNumber, todayInput } from '@/format';
import { RULE_LABELS, saveIndirectRate, saveMachine, savePositionRate, saveRules } from '@/store/actions';
import { useDataStore } from '@/store/data';
import { userName } from '@/store/selectors';
import { colors, font, spacing } from '@/theme';

type Tab = 'labor' | 'machines' | 'indirect' | 'rules';

/** Pending edit of a rate, saved with «Guardar cambios». */
interface Draft {
  value: string;
  kgPerHour?: string;
  active?: boolean;
  validFrom: string;
}

const RULE_KEYS: RuleKey[] = ['minMargin', 'maxWastePct', 'balanceTolerance'];
/** Rule as typed in the field: margin without decimals ("20"), the others with one ("3,0", "0,5"). */
const pctInput = (key: RuleKey, fraction: number) => formatNumber(fraction * 100, key === 'minMargin' ? 0 : 1);

export default function CostParametersScreen() {
  const db = useDataStore((s) => s.db);
  const today = new Date().toISOString();
  const [tab, setTab] = useState<Tab>('labor');
  const [selected, setSelected] = useState<string | undefined>();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [rules, setRules] = useState<Record<RuleKey, string>>(() => ({
    minMargin: pctInput('minMargin', db.settings.minMargin),
    maxWastePct: pctInput('maxWastePct', db.settings.maxWastePct),
    balanceTolerance: pctInput('balanceTolerance', db.settings.balanceTolerance),
  }));
  const [errors, setErrors] = useState<FieldErrors>({});

  const laborRows = db.positions.map((p) => {
    const rate = inForce(db.positionRates.filter((r) => r.positionId === p.id), today);
    return { id: `pos:${p.id}`, name: p.name, value: rate?.hourlyCost ?? 0, validFrom: rate?.validFrom ?? '', history: db.positionRates.filter((r) => r.positionId === p.id) };
  });
  const machineRows = db.machines.map((m) => {
    const rate = inForce(db.machineRates.filter((r) => r.machineId === m.id), today);
    return { id: `mac:${m.id}`, machine: m, name: m.code, value: rate?.hourlyCost ?? 0, validFrom: rate?.validFrom ?? '', history: db.machineRates.filter((r) => r.machineId === m.id) };
  });
  const indirect = inForce(db.indirectRates, today);

  const draftOf = (id: string, value: number, extra: Partial<Draft> = {}): Draft => drafts[id] ?? { value: formatNumber(value, 2), validFrom: todayInput(), ...extra };
  const setDraft = (id: string, base: Draft, patch: Partial<Draft>) => {
    setDrafts((d) => ({ ...d, [id]: { ...base, ...patch } }));
    setErrors({});
  };
  const pending = Object.keys(drafts).length;

  const saveAll = () => {
    const nextErrors: FieldErrors = {};
    let saved = 0;
    for (const [id, d] of Object.entries(drafts)) {
      const [kind, ref] = id.split(':');
      const validFrom = parseDateInput(d.validFrom);
      const value = parseNumber(d.value);
      const result =
        kind === 'pos'
          ? savePositionRate(ref, value, validFrom)
          : kind === 'mac'
            ? saveMachine(ref, { hourlyCost: value, kgPerHour: parseNumber(d.kgPerHour ?? ''), active: d.active ?? true, validFrom })
            : saveIndirectRate(value, validFrom);
      if (!result.ok) {
        for (const [field, msg] of Object.entries(result.errors)) nextErrors[`${id}.${field}`] = msg;
        setSelected(id);
      } else saved++;
    }
    const ruleResult = saveRules(
      { minMargin: parseNumber(rules.minMargin) / 100, maxWastePct: parseNumber(rules.maxWastePct) / 100, balanceTolerance: parseNumber(rules.balanceTolerance) / 100 },
      dateKey(today),
    );
    if (!ruleResult.ok) Object.assign(nextErrors, ruleResult.errors);
    else saved += ruleResult.value;
    setErrors(nextErrors);
    setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([id]) => Object.keys(nextErrors).some((k) => k.startsWith(`${id}.`)))));
    if (Object.keys(nextErrors).length) showToast('error', 'Revise los campos marcados en rojo.');
    else showToast('success', saved ? `${saved} ${saved === 1 ? 'cambio guardado' : 'cambios guardados'}. El valor anterior quedó en el historial.` : 'No hay cambios por guardar.');
  };

  const historyLink = (id: string) => <LinkButton title="Historial" onPress={() => setSelected(id)} style={styles.historyLink} />;
  const valueCell = (id: string, value: number) => (
    <Text style={[styles.num, (selected === id || drafts[id]) && styles.bold]}>{formatNumber(drafts[id] ? parseNumber(drafts[id].value) : value, 2)}</Text>
  );

  type LaborRow = (typeof laborRows)[number];
  type MachineRow = (typeof machineRows)[number];
  const laborColumns: Column<LaborRow>[] = [
    { key: 'name', title: 'Cargo', flex: 2.2, minWidth: 200, render: (r) => <Text style={styles.cell}>{r.name}</Text> },
    { key: 'value', title: 'USD por hora', flex: 1, minWidth: 110, align: 'right', render: (r) => valueCell(r.id, r.value) },
    { key: 'from', title: 'Vigente desde', flex: 1.2, minWidth: 120, render: (r) => (drafts[r.id] ? <StatusBadge label="Sin guardar" tone="warning" /> : formatDate(r.validFrom)) },
    { key: 'hist', title: '', flex: 0.8, minWidth: 90, align: 'right', render: (r) => historyLink(r.id) },
  ];
  const machineColumns: Column<MachineRow>[] = [
    { key: 'code', title: 'Máquina', flex: 0.9, minWidth: 90, render: (r) => r.machine.code },
    { key: 'section', title: 'Sección', flex: 1, minWidth: 100, render: (r) => sectionLabels[r.machine.section] },
    { key: 'kg', title: 'kg/h', flex: 0.6, minWidth: 70, align: 'right', render: (r) => formatNumber(r.machine.kgPerHour) },
    { key: 'state', title: 'Estado', flex: 1.1, minWidth: 130, render: (r) => <StatusBadge label={r.machine.active ? 'Operativa' : 'Mantenimiento'} tone={r.machine.active ? 'success' : 'warning'} /> },
    { key: 'value', title: 'USD por hora', flex: 1, minWidth: 110, align: 'right', render: (r) => valueCell(r.id, r.value) },
    { key: 'from', title: 'Vigente desde', flex: 1.1, minWidth: 120, render: (r) => (drafts[r.id] ? <StatusBadge label="Sin guardar" tone="warning" /> : formatDate(r.validFrom)) },
    { key: 'hist', title: '', flex: 0.8, minWidth: 90, align: 'right', render: (r) => historyLink(r.id) },
  ];

  // ---- edit card of the selected rate ----
  const labor = laborRows.find((r) => r.id === selected);
  const mac = machineRows.find((r) => r.id === selected);
  const isIndirect = selected === 'ind';
  const editing = tab === 'labor' ? labor : tab === 'machines' ? mac : tab === 'indirect' ? (isIndirect ? { id: 'ind', name: 'Costos indirectos', value: indirect?.hourlyCost ?? 0 } : undefined) : undefined;
  const history = tab === 'labor' ? labor?.history : tab === 'machines' ? mac?.history : tab === 'indirect' ? db.indirectRates : undefined;

  const editCard = editing && (
    <Card title={`Nueva tarifa · ${editing.name}`} subtitle="El valor actual pasa al historial desde la fecha de vigencia.">
      {(() => {
        const base = draftOf(editing.id, editing.value, mac ? { kgPerHour: formatNumber(mac.machine.kgPerHour), active: mac.machine.active } : {});
        const e = (f: string) => errors[`${editing.id}.${f}`];
        return (
          <View style={styles.editGrid}>
            <View style={styles.editField}>
              <TextField
                label={isIndirect ? 'USD por hora productiva' : 'USD por hora'}
                value={base.value}
                onChangeText={(value) => setDraft(editing.id, base, { value })}
                keyboardType="decimal-pad"
                error={e('hourlyCost') ?? e('indirect')}
                testID="rate-value"
              />
            </View>
            {mac && (
              <>
                <View style={styles.editField}>
                  <TextField
                    label="Rendimiento (kg/h)"
                    value={base.kgPerHour ?? ''}
                    onChangeText={(kgPerHour) => setDraft(editing.id, base, { kgPerHour })}
                    keyboardType="decimal-pad"
                    error={e('kgPerHour')}
                    hint="Estima las horas de la etapa."
                  />
                </View>
                <View style={styles.editField}>
                  <SelectField
                    label="Estado"
                    value={base.active === false ? 'off' : 'on'}
                    options={[
                      { value: 'on', label: 'Operativa' },
                      { value: 'off', label: 'En mantenimiento' },
                    ]}
                    onChange={(v) => setDraft(editing.id, base, { active: v === 'on' })}
                  />
                </View>
              </>
            )}
            <View style={styles.editField}>
              <TextField label="Vigente desde" value={base.validFrom} onChangeText={(validFrom) => setDraft(editing.id, base, { validFrom })} placeholder="dd/mm/aaaa" error={e('validFrom')} testID="rate-from" />
            </View>
          </View>
        );
      })()}
      {history && history.length > 0 && (
        <View style={styles.history}>
          <Text style={styles.historyTitle}>Historial</Text>
          {[...history]
            .sort((a, b) => b.validFrom.localeCompare(a.validFrom))
            .map((h) => (
              <View key={h.id} style={styles.historyRow}>
                <Text style={styles.historyText}>Desde {formatDate(h.validFrom)}</Text>
                <Text style={[styles.historyText, styles.bold]}>{formatNumber(h.hourlyCost, 2)} USD/h</Text>
                <Text style={styles.historyMuted}>{userName(db, h.createdBy)}</Text>
              </View>
            ))}
        </View>
      )}
    </Card>
  );

  const indirectCard = (
    <Card title="Costos indirectos">
      <View style={styles.indirectRow}>
        <Text style={styles.indirectLabel}>Tasa por hora productiva</Text>
        <Text style={styles.indirectValue}>{formatNumber(drafts.ind ? parseNumber(drafts.ind.value) : indirect?.hourlyCost ?? 0, 2)} USD</Text>
      </View>
      <Text style={styles.small}>Incluye servicios básicos y otros gastos de planta. No se guardan sueldos individuales ni datos de nómina.</Text>
      {tab !== 'indirect' && <LinkButton title="Cambiar tasa" onPress={() => { setTab('indirect'); setSelected('ind'); }} />}
    </Card>
  );

  const ruleHistory = [...db.ruleRates].sort((a, b) => b.validFrom.localeCompare(a.validFrom) || b.id.localeCompare(a.id));

  return (
    <Page
      title="Parámetros de costeo"
      subtitle="Tarifas y reglas con fecha de vigencia"
      actions={<Button title={pending ? `Guardar cambios (${pending})` : 'Guardar cambios'} onPress={saveAll} testID="save-params" />}
      testID="screen-W-14"
    >
      <Tabs
        value={tab}
        onChange={(t) => {
          setTab(t);
          setSelected(t === 'indirect' ? 'ind' : undefined);
        }}
        options={[
          { value: 'labor', label: 'Mano de obra' },
          { value: 'machines', label: 'Máquinas' },
          { value: 'indirect', label: 'Indirectos' },
          { value: 'rules', label: 'Reglas' },
        ]}
      />
      <Row gap={spacing.xl}>
        <Col flex={1.55} minWidth={520}>
          {tab === 'labor' && <DataTable framed columns={laborColumns} rows={laborRows} rowKey={(r) => r.id} selectedKey={selected} onRowPress={(r) => setSelected(r.id)} testID="labor-table" />}
          {tab === 'machines' && <DataTable framed columns={machineColumns} rows={machineRows} rowKey={(r) => r.id} selectedKey={selected} onRowPress={(r) => setSelected(r.id)} testID="machines-table" />}
          {tab === 'rules' && (
            <DataTable
              framed
              columns={[
                { key: 'rule', title: 'Regla', flex: 1.6, minWidth: 180, render: (r) => RULE_LABELS[r.key] },
                { key: 'value', title: 'Valor', flex: 0.8, minWidth: 90, align: 'right', render: (r) => formatPercent(r.value) },
                { key: 'from', title: 'Vigente desde', flex: 1, minWidth: 120, render: (r) => formatDate(r.validFrom) },
                { key: 'by', title: 'Registró', flex: 1.2, minWidth: 140, render: (r) => userName(db, r.createdBy) },
              ]}
              rows={ruleHistory}
              rowKey={(r) => r.id}
            />
          )}
          {editCard}
          {tab !== 'rules' && indirectCard}
        </Col>
        <Col minWidth={340}>
          <Card title="Reglas comerciales y de producción">
            <TextField
              label="Ganancia mínima sobre el costo"
              value={rules.minMargin}
              onChangeText={(v) => setRules((r) => ({ ...r, minMargin: v }))}
              keyboardType="decimal-pad"
              trailing={<Text style={styles.unit}>%</Text>}
              error={errors.minMargin}
              hint="Una cotización por debajo pide autorización."
              testID="rule-minMargin"
            />
            <TextField
              label="Umbral de merma por etapa"
              value={rules.maxWastePct}
              onChangeText={(v) => setRules((r) => ({ ...r, maxWastePct: v }))}
              keyboardType="decimal-pad"
              trailing={<Text style={styles.unit}>%</Text>}
              error={errors.maxWastePct}
              hint="Sobre este valor el seguimiento muestra una alerta."
              testID="rule-maxWastePct"
            />
            <TextField
              label="Tolerancia del balance de materiales"
              value={rules.balanceTolerance}
              onChangeText={(v) => setRules((r) => ({ ...r, balanceTolerance: v }))}
              keyboardType="decimal-pad"
              trailing={<Text style={styles.unit}>%</Text>}
              error={errors.balanceTolerance}
              hint="Diferencias mayores piden justificación al operario."
              testID="rule-balanceTolerance"
            />
            <Note>Los cambios aplican desde su fecha de vigencia. Las órdenes cerradas conservan sus valores.</Note>
            {RULE_KEYS.some((k) => Math.abs(parseNumber(rules[k]) / 100 - db.settings[k]) > 1e-9) && (
              <Text style={styles.small}>Las reglas modificadas regirán desde hoy al pulsar «Guardar cambios».</Text>
            )}
          </Card>
        </Col>
      </Row>
    </Page>
  );
}

const styles = StyleSheet.create({
  cell: { fontSize: 15, color: colors.text },
  num: { fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'], textAlign: 'right' },
  bold: { fontWeight: font.weight.semibold },
  historyLink: { fontSize: 13, fontWeight: font.weight.regular, color: colors.textMuted, textDecorationLine: 'none' },
  editGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  editField: { flexGrow: 1, flexBasis: 160 },
  history: { gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  historyTitle: { fontSize: 13, fontWeight: font.weight.semibold, color: colors.text },
  historyRow: { flexDirection: 'row', gap: spacing.lg },
  historyText: { fontSize: 14, color: colors.text, minWidth: 130 },
  historyMuted: { fontSize: 14, color: colors.textMuted },
  indirectRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  indirectLabel: { fontSize: 15, color: colors.textMuted },
  indirectValue: { fontSize: 16, fontWeight: font.weight.semibold, color: colors.text },
  small: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  unit: { fontSize: 15, color: colors.textMuted },
});
