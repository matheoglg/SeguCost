// W-21 Integración con Dobra (RF-43, RF-44, RF-04). CSV exchange; provisional format until SP-01 closes.
import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Checkbox, Tabs } from '@/components/Inputs';
import { StatusBadge } from '@/components/StatusBadge';
import { showToast } from '@/components/Toast';
import { DataTable } from '@/components/web/DataTable';
import { KpiCard } from '@/components/web/KpiCard';
import { Card, Col, Note, Page, Row } from '@/components/web/Page';
import { standardCost } from '@/domain/costing';
import { EXPORT_HEADER, IMPORT_HEADER, IMPORT_SAMPLE_WITH_ERRORS, IMPORT_TEMPLATE, type ImportResult } from '@/domain/dobra';
import { currentReferencePrice } from '@/domain/pricing';
import { downloadCsv } from '@/download';
import { formatDateTime, formatNumber, formatUnitCost } from '@/format';
import { exportToDobra, importCatalog } from '@/store/actions';
import { useDataStore } from '@/store/data';
import { userName } from '@/store/selectors';
import { colors, font, spacing } from '@/theme';

export default function DobraScreen() {
  const db = useDataStore((s) => s.db);
  const [tab, setTab] = useState<'export' | 'import'>('export');
  const now = new Date().toISOString();
  const products = db.products.map((p) => ({ product: p, price: currentReferencePrice(db.priceProposals, p.id), cost: standardCost(db, p.id, now).unitCost }));
  const exportable = products.filter((p) => p.price);
  const [selected, setSelected] = useState<string[]>(() => exportable.map((p) => p.product.id));
  const [result, setResult] = useState<{ fileName: string; summary: ImportResult }>();

  const generate = () => {
    const r = exportToDobra(selected);
    if (!r.ok) return showToast('error', Object.values(r.errors)[0]);
    downloadCsv(r.value.fileName, r.value.csv);
  };
  const runImport = (text: string, fileName: string) => {
    const summary = importCatalog(text);
    setResult({ fileName, summary });
    const loaded = summary.materials.length + summary.products.length + summary.suppliers.length;
    showToast(summary.rejected.length ? 'error' : 'success', `${loaded} filas cargadas, ${summary.rejected.length} rechazadas`);
  };
  const pickFile = () => {
    if (Platform.OS !== 'web') return showToast('info', 'La carga de archivos está disponible en la versión web.');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) runImport(await file.text(), file.name);
    };
    input.click();
  };

  return (
    <Page>
      <Tabs value={tab} onChange={setTab} options={[{ value: 'export', label: 'Exportar' }, { value: 'import', label: 'Importar' }]} />
      {tab === 'export' ? (
        <>
          <Note tone="info">
            Archivo CSV con las columnas {EXPORT_HEADER.split(',').join(', ')}. Solo se incluyen fundas con precio referencial aprobado. Formato provisional hasta cerrar el spike SP-01.
          </Note>
          <Row>
            <Col minWidth={560} flex={1.6}>
              <Card title="Fundas a exportar" subtitle={`${selected.length} seleccionadas`} actions={<Button title="Generar archivo" icon="download" onPress={generate} disabled={!selected.length} testID="generate-export" />} padded={false}>
                <DataTable
                  rows={products}
                  rowKey={(r) => r.product.id}
                  columns={[
                    {
                      key: 's',
                      title: '',
                      flex: 0.3,
                      minWidth: 60,
                      render: (r) =>
                        r.price ? (
                          <Checkbox label="" checked={selected.includes(r.product.id)} onChange={(v) => setSelected((s) => (v ? [...s, r.product.id] : s.filter((x) => x !== r.product.id)))} testID={`export-${r.product.code}`} />
                        ) : null,
                    },
                    { key: 'c', title: 'Código', flex: 0.7, render: (r) => r.product.code },
                    { key: 'n', title: 'Nombre', flex: 2, render: (r) => r.product.name },
                    { key: 'u', title: 'Costo unitario', align: 'right', render: (r) => formatUnitCost(r.cost) },
                    { key: 'p', title: 'Precio referencial', align: 'right', render: (r) => (r.price ? formatUnitCost(r.price.price) : <StatusBadge label="Sin precio aprobado" tone="neutral" />) },
                  ]}
                />
              </Card>
            </Col>
            <Col minWidth={480}>
              <Card title="Historial de exportaciones" padded={false}>
                <DataTable
                  rows={[...db.dobraExports].reverse()}
                  rowKey={(x) => x.id}
                  columns={[
                    { key: 'd', title: 'Fecha', minWidth: 100, render: (x) => formatDateTime(x.at) },
                    { key: 'u', title: 'Usuario', minWidth: 100, render: (x) => userName(db, x.userId) },
                    { key: 'f', title: 'Archivo', flex: 1.8, minWidth: 200, render: (x) => x.fileName },
                    { key: 'n', title: 'Fundas', align: 'right', flex: 0.4, minWidth: 64, render: (x) => String(x.productIds.length) },
                  ]}
                />
              </Card>
            </Col>
          </Row>
        </>
      ) : (
        <>
          <Card title="Importación del catálogo inicial" subtitle="Materias primas, proveedores y fundas desde la plantilla CSV">
            <Text style={styles.muted}>Columnas: {IMPORT_HEADER.join(', ')}. La columna «entidad» indica si la fila es un insumo, una funda o un proveedor. Las filas que ya existen no se duplican.</Text>
            <Row>
              <Button title="Descargar plantilla" icon="download" variant="secondary" onPress={() => downloadCsv('plantilla_catalogo_segucost.csv', IMPORT_TEMPLATE)} testID="download-template" />
              <Button title="Cargar archivo" icon="upload" onPress={pickFile} testID="upload-file" />
              <Button title="Probar con archivo de ejemplo (con errores)" variant="ghost" onPress={() => runImport(IMPORT_SAMPLE_WITH_ERRORS, 'catalogo_ejemplo.csv')} testID="sample-import" />
            </Row>
          </Card>
          {result && (
            <>
              <Row>
                <KpiCard label="Filas en el archivo" value={formatNumber(result.summary.totalRows)} detail={result.fileName} />
                <KpiCard label="Filas cargadas" tone="success" value={formatNumber(result.summary.materials.length + result.summary.products.length + result.summary.suppliers.length)} detail={`${result.summary.materials.length} insumos · ${result.summary.products.length} fundas · ${result.summary.suppliers.length} proveedores`} />
                <KpiCard label="Filas rechazadas" tone={result.summary.rejected.length ? 'alert' : 'neutral'} value={formatNumber(result.summary.rejected.length)} />
                <KpiCard label="Ya existentes (omitidas)" value={formatNumber(result.summary.skipped.length)} />
              </Row>
              <Card title="Filas rechazadas y omitidas" padded={false}>
                <DataTable
                  rows={[...result.summary.rejected.map((r) => ({ ...r, kind: 'Rechazada' })), ...result.summary.skipped.map((r) => ({ ...r, kind: 'Omitida' }))].sort((a, b) => a.row - b.row)}
                  rowKey={(r) => `${r.kind}-${r.row}`}
                  highlight={(r) => (r.kind === 'Rechazada' ? 'alert' : undefined)}
                  emptyText="Todas las filas se cargaron."
                  columns={[
                    { key: 'r', title: 'Fila', flex: 0.4, render: (r) => String(r.row) },
                    { key: 'k', title: 'Resultado', flex: 0.6, render: (r) => r.kind },
                    { key: 'm', title: 'Motivo', flex: 3, render: (r) => r.reason },
                  ]}
                />
              </Card>
            </>
          )}
        </>
      )}
      <View style={{ height: spacing.lg }} />
    </Page>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: font.size.sm, color: colors.textMuted },
});
