// W-13 Costos de recursos (RF-29, RF-30). Hourly cost of plant positions and machines, with history.
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Tabs } from '@/components/Inputs';
import { StatusBadge } from '@/components/StatusBadge';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { DataTable } from '@/components/web/DataTable';
import { Card, Col, Note, Page, Row } from '@/components/web/Page';
import { sectionLabels } from '@/domain/labels';
import { inForce } from '@/domain/prices';
import { formatDate, formatMoney, parseDateInput, parseNumber, todayInput } from '@/format';
import { saveMachineRate, savePositionRate } from '@/store/actions';
import { useDataStore } from '@/store/data';
import { userName } from '@/store/selectors';
import { useCurrentUser } from '@/store/session';
import { colors, font, spacing } from '@/theme';

type Tab = 'labor' | 'machines';
interface RateRow {
  id: string;
  name: string;
  detail: string;
  history: { id: string; hourlyCost: number; validFrom: string; createdBy: string }[];
}

export default function ResourceCostsScreen() {
  const user = useCurrentUser()!;
  const db = useDataStore((s) => s.db);
  const [tab, setTab] = useState<Tab>('labor');
  const [selected, setSelected] = useState<string>();
  const [cost, setCost] = useState('');
  const [validFrom, setValidFrom] = useState(todayInput());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const now = new Date().toISOString();
  // RR. HH. maintains labor costs; machine costs are maintained by the Administradora (flow 2).
  const canEditTab = tab === 'labor' ? user.role === 'adm' || user.role === 'rrhh' : user.role === 'adm';

  const rows: RateRow[] =
    tab === 'labor'
      ? db.positions.map((p) => ({
          id: p.id,
          name: p.name,
          detail: ((n) => `${n} operario${n === 1 ? '' : 's'}`)(db.users.filter((u) => u.positionId === p.id && u.active).length),
          history: db.positionRates.filter((r) => r.positionId === p.id),
        }))
      : db.machines.map((m) => ({ id: m.id, name: m.code, detail: sectionLabels[m.section], history: db.machineRates.filter((r) => r.machineId === m.id) }));
  const row = rows.find((r) => r.id === selected) ?? rows[0];
  const vigente = (r: RateRow) => inForce(r.history, now);

  const save = () => {
    const value = parseNumber(cost);
    const date = parseDateInput(validFrom);
    const r = tab === 'labor' ? savePositionRate(row.id, value, date) : saveMachineRate(row.id, value, date);
    if (!r.ok) return setErrors(r.errors);
    showToast('success', `Nuevo costo de ${row.name}: ${formatMoney(value)}/h; el anterior queda en el historial`);
    setCost('');
    setErrors({});
  };

  return (
    <Page>
      <Tabs
        value={tab}
        onChange={(v) => {
          setTab(v);
          setSelected(undefined);
          setErrors({});
        }}
        options={[
          { value: 'labor', label: 'Mano de obra' },
          { value: 'machines', label: 'Máquinas' },
        ]}
      />
      <Row>
        <Col minWidth={560} flex={1.6}>
          <Card title={tab === 'labor' ? 'Costo por hora de cada cargo de planta' : 'Costo por hora de operación de cada máquina'} padded={false}>
            <DataTable
              rows={rows}
              rowKey={(r) => r.id}
              selectedKey={row.id}
              onRowPress={(r) => {
                setSelected(r.id);
                setErrors({});
              }}
              columns={[
                { key: 'n', title: tab === 'labor' ? 'Cargo' : 'Máquina', flex: 1.6, render: (r) => r.name },
                { key: 'd', title: tab === 'labor' ? 'Personal' : 'Sección', render: (r) => r.detail },
                { key: 'c', title: 'Costo hora vigente', align: 'right', render: (r) => (vigente(r) ? formatMoney(vigente(r)!.hourlyCost) : '—') },
                { key: 'v', title: 'Vigencia', render: (r) => (vigente(r) ? formatDate(vigente(r)!.validFrom) : '—') },
              ]}
            />
          </Card>
        </Col>
        <Col minWidth={340}>
          <Card title={row.name} subtitle="Historial">
            {[...row.history].reverse().map((h, i) => (
              <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text style={{ flex: 1, fontSize: font.size.md, color: colors.text, fontWeight: i === 0 ? font.weight.bold : font.weight.regular }}>{formatMoney(h.hourlyCost)}/h</Text>
                <Text style={{ fontSize: font.size.sm, color: colors.textMuted }}>
                  desde {formatDate(h.validFrom)} · {userName(db, h.createdBy)}
                </Text>
                {vigente(row)?.id === h.id && <StatusBadge label="Vigente" tone="success" />}
              </View>
            ))}
            {canEditTab ? (
              <>
                <TextField label="Nuevo costo por hora (USD)" value={cost} onChangeText={(t) => { setCost(t); setErrors({}); }} keyboardType="decimal-pad" error={errors.hourlyCost} testID="rate-value" />
                <TextField label="Vigente desde" value={validFrom} onChangeText={setValidFrom} placeholder="dd/mm/aaaa" error={errors.validFrom} />
                <Button title="Guardar" onPress={save} testID="save-rate" />
              </>
            ) : (
              <Note tone="info">Solo la Administradora actualiza el costo de las máquinas.</Note>
            )}
          </Card>
        </Col>
      </Row>
    </Page>
  );
}
