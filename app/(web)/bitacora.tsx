// W-22 Bitácora (RF-04). Read only: entries cannot be edited from any screen.
import { useState } from 'react';
import { View } from 'react-native';

import { SelectField } from '@/components/Inputs';
import { TextField } from '@/components/TextField';
import { DataTable } from '@/components/web/DataTable';
import { Card, Page, Row } from '@/components/web/Page';
import { dateKey } from '@/domain/prices';
import { formatDateTime, parseDateInput } from '@/format';
import { useDataStore } from '@/store/data';
import { userName } from '@/store/selectors';

export default function AuditLogScreen() {
  const db = useDataStore((s) => s.db);
  const [userId, setUserId] = useState('all');
  const [entity, setEntity] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const entities = [...new Set(db.auditLog.map((a) => a.entity))].sort();
  const fromKey = parseDateInput(from);
  const toKey = parseDateInput(to);
  const rows = db.auditLog
    .filter((a) => (userId === 'all' || a.userId === userId) && (entity === 'all' || a.entity === entity) && (!fromKey || dateKey(a.at) >= fromKey) && (!toKey || dateKey(a.at) <= toKey))
    .sort((a, b) => b.at.localeCompare(a.at));

  return (
    <Page intro="Registro de creaciones, modificaciones, aprobaciones y anulaciones de recetas, precios, costos y órdenes, con usuario, fecha y hora. Solo consulta.">
      <Card>
        <Row align="flex-end">
          <View style={{ width: 240 }}>
            <SelectField label="Usuario" value={userId} onChange={setUserId} options={[{ value: 'all', label: 'Todos' }, ...db.users.filter((u) => db.auditLog.some((a) => a.userId === u.id)).map((u) => ({ value: u.id, label: u.name }))]} testID="audit-user" />
          </View>
          <View style={{ width: 260 }}>
            <SelectField label="Entidad" value={entity} onChange={setEntity} options={[{ value: 'all', label: 'Todas' }, ...entities.map((e) => ({ value: e, label: e }))]} testID="audit-entity" />
          </View>
          <View style={{ width: 150 }}>
            <TextField label="Desde" value={from} onChangeText={setFrom} placeholder="dd/mm/aaaa" />
          </View>
          <View style={{ width: 150 }}>
            <TextField label="Hasta" value={to} onChangeText={setTo} placeholder="dd/mm/aaaa" />
          </View>
        </Row>
      </Card>
      <Card title="Operaciones registradas" subtitle={`${rows.length} registros`} padded={false}>
        <DataTable
          rows={rows}
          rowKey={(a) => a.id}
          emptyText="Sin registros con estos filtros."
          columns={[
            { key: 'd', title: 'Fecha y hora', flex: 0.9, render: (a) => formatDateTime(a.at) },
            { key: 'u', title: 'Usuario', flex: 0.9, render: (a) => userName(db, a.userId) },
            { key: 'e', title: 'Entidad', flex: 0.9, render: (a) => a.entity },
            { key: 'a', title: 'Acción', flex: 1.1, render: (a) => a.action },
            { key: 'b', title: 'Valor anterior', flex: 1.3, render: (a) => a.before ?? '—' },
            { key: 'n', title: 'Valor nuevo', flex: 1.3, render: (a) => a.after ?? '—' },
          ]}
        />
      </Card>
    </Page>
  );
}
