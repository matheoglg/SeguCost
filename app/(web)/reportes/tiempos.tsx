// W-19 Reportes de tiempos (RF-40, RF-41). The downloads use the same filters and totals as the screen.
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { BarChart } from '@/components/Chart';
import { SelectField } from '@/components/Inputs';
import { TextField } from '@/components/TextField';
import { DataTable } from '@/components/web/DataTable';
import { Card, Page, Row } from '@/components/web/Page';
import { timeReport, type TimeReportRow } from '@/domain/reports';
import { esc, downloadFile, printHtml } from '@/download';
import { formatDuration, formatNumber, formatPercent, parseDateInput, todayInput } from '@/format';
import { useDataStore } from '@/store/data';
import { machineCode, userName } from '@/store/selectors';
import { chartColors } from '@/theme';
import { buildXlsx } from '@/xlsx';

const H = 3_600_000;
const hours = (ms: number) => Math.round((ms / H) * 100) / 100;

export default function TimeReportScreen() {
  const db = useDataStore((s) => s.db);
  const [from, setFrom] = useState(todayInput(-30));
  const [to, setTo] = useState(todayInput());
  const [operatorId, setOperatorId] = useState<string>('all');
  const [machineId, setMachineId] = useState<string>('all');

  const filters = { from: parseDateInput(from) || undefined, to: parseDateInput(to) || undefined, operatorId: operatorId === 'all' ? undefined : operatorId, machineId: machineId === 'all' ? undefined : machineId };
  const { rows, total } = timeReport(db, filters);
  const name = (r: TimeReportRow) => (r.operatorId === 'total' ? 'Total' : userName(db, r.operatorId));
  const filterText = `Del ${from} al ${to} · Operario: ${operatorId === 'all' ? 'todos' : userName(db, operatorId)} · Máquina: ${machineId === 'all' ? 'todas' : machineCode(db, machineId)}`;
  const header = ['Operario', 'Marcaciones', 'Tiempo efectivo (h)', 'Pausas activas (h)', 'Descansos (h)', 'Tiempo de máquina (h)', '% efectivo'];
  const toCells = (r: TimeReportRow) => [name(r), r.entries, hours(r.effectiveMs), hours(r.activePauseMs), hours(r.restMs), hours(r.machineMs), Math.round(r.effectiveShare * 1000) / 10];
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const excel = () =>
    downloadFile(
      `reporte_tiempos_${stamp}.xlsx`,
      buildXlsx('Tiempos', [['Reporte de tiempos y pausas · SeguCost'], [filterText], [], header, ...rows.map(toCells), toCells(total)]) as BlobPart,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  const pdf = () =>
    printHtml(
      'Reporte de tiempos y pausas',
      `<h1>Reporte de tiempos y pausas</h1><p>${esc(filterText)}</p><table><tr>${header.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>${[...rows, total]
        .map((r) => `<tr>${toCells(r).map((c, i) => `<td class="${i ? 'n' : ''}">${esc(typeof c === 'number' ? formatNumber(c, i === 1 ? 0 : i === 6 ? 1 : 2) : c)}</td>`).join('')}</tr>`)
        .join('')}</table><p>SeguCost · SEGUPLAST S.A.</p>`,
    );

  return (
    <Page>
      <Card>
        <Row align="flex-end">
          <View style={{ width: 150 }}>
            <TextField label="Desde" value={from} onChangeText={setFrom} placeholder="dd/mm/aaaa" />
          </View>
          <View style={{ width: 150 }}>
            <TextField label="Hasta" value={to} onChangeText={setTo} placeholder="dd/mm/aaaa" />
          </View>
          <View style={{ width: 240 }}>
            <SelectField label="Operario" value={operatorId} onChange={setOperatorId} options={[{ value: 'all', label: 'Todos' }, ...db.users.filter((u) => u.role === 'ope').map((u) => ({ value: u.id, label: u.name }))]} testID="filter-operator" />
          </View>
          <View style={{ width: 200 }}>
            <SelectField label="Máquina" value={machineId} onChange={setMachineId} options={[{ value: 'all', label: 'Todas' }, ...db.machines.map((m) => ({ value: m.id, label: m.code }))]} testID="filter-machine" />
          </View>
          <View style={{ flex: 1 }} />
          <Button title="Descargar Excel" icon="download" onPress={excel} testID="download-excel" />
          <Button title="Descargar PDF" icon="download" variant="secondary" onPress={pdf} testID="download-pdf" />
        </Row>
      </Card>

      <Card title="Tiempo por operario" subtitle="Horas efectivas, pausas activas y descansos">
        <BarChart
          stacked
          height={260}
          categories={rows.map((r) => userName(db, r.operatorId))}
          series={[
            { name: 'Tiempo efectivo', values: rows.map((r) => hours(r.effectiveMs)), color: chartColors[0] },
            { name: 'Pausas activas', values: rows.map((r) => hours(r.activePauseMs)), color: chartColors[2] },
            { name: 'Descansos', values: rows.map((r) => hours(r.restMs)), color: chartColors[1] },
          ]}
          formatValue={(n) => `${formatNumber(n, n < 10 && n % 1 ? 1 : 0)} h`}
        />
      </Card>

      <Card title="Detalle" subtitle={filterText} padded={false}>
        <DataTable
          rows={[...rows, total]}
          rowKey={(r) => r.operatorId}
          emptyText="Sin marcaciones con estos filtros."
          highlight={(r) => (r.operatorId === 'total' ? 'success' : undefined)}
          columns={[
            { key: 'o', title: 'Operario', flex: 1.4, render: name },
            { key: 'n', title: 'Marcaciones', align: 'right', flex: 0.7, render: (r) => formatNumber(r.entries) },
            { key: 'e', title: 'Tiempo efectivo', align: 'right', render: (r) => formatDuration(r.effectiveMs) },
            { key: 'a', title: 'Pausas activas', align: 'right', render: (r) => formatDuration(r.activePauseMs) },
            { key: 'r', title: 'Descansos', align: 'right', render: (r) => formatDuration(r.restMs) },
            { key: 'm', title: 'Tiempo de máquina', align: 'right', render: (r) => formatDuration(r.machineMs) },
            { key: 'p', title: '% efectivo', align: 'right', flex: 0.7, render: (r) => formatPercent(r.effectiveShare) },
          ]}
        />
      </Card>
    </Page>
  );
}
