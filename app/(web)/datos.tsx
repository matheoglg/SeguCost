// W-20 Importar datos (RF-50) and W-20b Exportar datos (RF-51): SeguCost's own CSV files, no Dobra connection.
// Import is all or nothing: a file with errors imports nothing until it is corrected.
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, LinkButton } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Checkbox, Tabs } from '@/components/Inputs';
import { showToast } from '@/components/Toast';
import { DataTable, type Column } from '@/components/web/DataTable';
import { Card, Col, Note, Page, Row } from '@/components/web/Page';
import { IMPORT_TEMPLATE, SAMPLE_FILE_CORRECTED, SAMPLE_FILE_WITH_ERRORS, validateImport, validRows, type CatalogImport, type ImportError } from '@/domain/csvImport';
import { downloadCsv } from '@/download';
import { formatDateTime, formatDay, formatNumber, formatTime } from '@/format';
import { buildApprovedCsv, EXPORT_COLUMNS, exportApprovedPrices, importInitialData } from '@/store/actions';
import { useDataStore } from '@/store/data';
import { approvedPrices, userName } from '@/store/selectors';
import { colors, font, spacing } from '@/theme';

type Tab = 'import' | 'export';

export default function DataExchangeScreen() {
  const [tab, setTab] = useState<Tab>('import');
  return (
    <Page title="Importar y exportar datos" subtitle="Archivos CSV propios de SeguCost; no requiere conexión con Dobra" testID="screen-W-20">
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'import', label: 'Importar' },
          { value: 'export', label: 'Exportar' },
        ]}
      />
      {tab === 'import' ? <ImportTab /> : <ExportTab />}
    </Page>
  );
}

function StepCard({ n, done, title, children }: { n: number; done: boolean; title: string; children: React.ReactNode }) {
  return (
    <Card style={styles.step}>
      <View style={styles.stepHead}>
        <View style={[styles.stepBadge, done && styles.stepDone]}>
          {done ? <Icon name="check" color={colors.onPrimary} size={16} strokeWidth={2.5} /> : <Text style={styles.stepNumber}>{n}</Text>}
        </View>
        <Text style={styles.stepTitle}>{title}</Text>
      </View>
      {children}
    </Card>
  );
}

interface Upload {
  name: string;
  text: string;
  at: string;
  check: CatalogImport;
}

function ImportTab() {
  const db = useDataStore((s) => s.db);
  const [templateDone, setTemplateDone] = useState(false);
  const [upload, setUpload] = useState<Upload | null>(null);
  const [imported, setImported] = useState<CatalogImport | null>(null);

  const load = (name: string, text: string) => {
    setImported(null);
    setUpload({ name, text, at: new Date().toISOString(), check: validateImport(text, db) });
  };

  const pickFile = () => {
    if (Platform.OS !== 'web') {
      showToast('info', 'La carga de archivos se hace desde la versión web.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) load(file.name, await file.text());
    };
    input.click();
  };

  const confirm = () => {
    if (!upload) return;
    const result = importInitialData(upload.text, upload.name);
    if (!result.ok) {
      showToast('error', result.errors.file);
      return;
    }
    setImported(result.value);
    showToast('success', `Importación completa: ${validRows(result.value)} filas. Quedó en la bitácora.`);
  };

  const check = upload?.check;
  const errors = check?.errors ?? [];
  const valid = check ? validRows(check) : 0;
  const errorRows = new Set(errors.map((e) => e.row)).size;

  const columns: Column<ImportError>[] = [
    { key: 'row', title: 'Fila', flex: 0.5, minWidth: 70, align: 'right', render: (e) => String(e.row) },
    { key: 'type', title: 'Tipo', flex: 1, minWidth: 110, render: (e) => e.type },
    { key: 'field', title: 'Campo', flex: 1.2, minWidth: 140, render: (e) => e.field },
    { key: 'problem', title: 'Problema', flex: 3.4, minWidth: 280, render: (e) => e.problem },
    { key: 'value', title: 'Valor', flex: 1, minWidth: 100, render: (e) => e.value },
  ];

  return (
    <>
      <Row gap={spacing.xl}>
        <Col minWidth={260}>
          <StepCard n={1} done={templateDone} title="Descargar plantilla">
            <Text style={styles.text}>Plantilla de clientes, insumos y productos con instrucciones por columna.</Text>
            <View style={styles.leftAlign}>
              <Button
                title="Plantilla_SeguCost.csv"
                icon="download"
                variant="secondary"
                size="sm"
                onPress={() => {
                  downloadCsv('Plantilla_SeguCost.csv', IMPORT_TEMPLATE);
                  setTemplateDone(true);
                }}
                testID="download-template"
              />
            </View>
          </StepCard>
        </Col>
        <Col minWidth={260}>
          <StepCard n={2} done={!!upload} title="Subir archivo">
            {upload ? (
              <>
                <Text style={styles.text}>
                  {upload.name} · {formatNumber(upload.check.totalRows)} filas · subido {formatDay(upload.at).toLowerCase()} {formatTime(upload.at)}
                </Text>
                <View style={styles.leftAlign}>
                  <LinkButton title="Cambiar archivo" onPress={pickFile} />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.text}>Archivo CSV en UTF-8, con las columnas de la plantilla.</Text>
                <View style={styles.leftAlign}>
                  <Button title="Subir archivo" icon="upload" variant="secondary" size="sm" onPress={pickFile} testID="upload-file" />
                </View>
              </>
            )}
            <View style={styles.samples}>
              <Text style={styles.sampleLabel}>Prototipo:</Text>
              <LinkButton title="ejemplo con errores" onPress={() => load('carga_inicial.csv', SAMPLE_FILE_WITH_ERRORS)} style={styles.sampleLink} testID="sample-errors" />
              <LinkButton title="ejemplo corregido" onPress={() => load('carga_inicial_corregida.csv', SAMPLE_FILE_CORRECTED)} style={styles.sampleLink} testID="sample-ok" />
            </View>
          </StepCard>
        </Col>
        <Col minWidth={260}>
          <StepCard n={3} done={!!imported} title="Revisar y confirmar">
            <Text style={styles.text}>Se importa todo o nada: no quedan cargas a medias.</Text>
            <View style={styles.leftAlign}>
              <Button
                title={imported ? 'Importado' : `Importar ${formatNumber(valid)} filas`}
                disabled={!upload || errors.length > 0 || !!imported || valid === 0}
                onPress={confirm}
                testID="confirm-import"
              />
            </View>
          </StepCard>
        </Col>
      </Row>

      {upload && errors.length > 0 && (
        <>
          <Note tone="alert">
            {errorRows} {errorRows === 1 ? 'fila tiene errores' : 'filas tienen errores'}. No se importó ningún dato: corrija el archivo y vuelva a subirlo.
          </Note>
          <DataTable framed columns={columns} rows={errors} rowKey={(e) => `${e.row}-${e.field}`} testID="import-errors" />
        </>
      )}
      {upload && errors.length === 0 && !imported && (
        <Note tone="success">
          Las {formatNumber(valid)} filas son válidas: {upload.check.customers.length} clientes, {upload.check.materials.length} insumos y {upload.check.products.length} productos. Pulse «Importar {formatNumber(valid)} filas».
        </Note>
      )}
      {imported && (
        <Note tone="success">
          Importación completa: {imported.customers.length} clientes, {imported.materials.length} insumos y {imported.products.length} productos. Revise los insumos en Materias primas e insumos.
        </Note>
      )}
    </>
  );
}

function ExportTab() {
  const db = useDataStore((s) => s.db);
  const rows = approvedPrices(db);
  const [selected, setSelected] = useState<string[]>(() => rows.map((r) => r.productId));
  const [last, setLast] = useState<{ fileName: string; count: number } | null>(null);
  const chosen = rows.filter((r) => selected.includes(r.productId));
  const history = [...db.dobraExports].sort((a, b) => b.at.localeCompare(a.at));

  const generate = () => {
    const result = exportApprovedPrices(selected);
    if (!result.ok) {
      showToast('error', result.errors.form);
      return;
    }
    downloadCsv(result.value.fileName, result.value.csv);
    setLast({ fileName: result.value.fileName, count: chosen.length });
  };

  const redownload = (productIds: string[], fileName: string) => downloadCsv(fileName, buildApprovedCsv(rows.filter((r) => productIds.includes(r.productId))));
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  type R = (typeof rows)[number];
  const columns: Column<R>[] = [
    { key: 'sel', title: '', flex: 0.4, minWidth: 52, render: (r) => <Checkbox label="" checked={selected.includes(r.productId)} onChange={() => toggle(r.productId)} testID={`export-${r.code}`} /> },
    { key: 'code', title: 'Código', flex: 0.9, minWidth: 104, render: (r) => r.code },
    { key: 'name', title: 'Producto', flex: 2, minWidth: 180, render: (r) => r.name },
    { key: 'cost', title: 'Costo/funda', flex: 1, minWidth: 100, align: 'right', render: (r) => formatNumber(r.unitCost, 4) },
    { key: 'price', title: 'Precio', flex: 0.8, minWidth: 80, align: 'right', render: (r) => formatNumber(r.price, 4) },
    { key: 'quote', title: 'Origen', flex: 0.9, minWidth: 112, render: (r) => r.quote },
  ];
  const preview = buildApprovedCsv(chosen.slice(0, 1)).trim().split('\n');

  return (
    <>
      {last && <Note tone="success">Archivo generado: {last.fileName} ({last.count} {last.count === 1 ? 'producto' : 'productos'}). Quedó en el historial.</Note>}
      <Row gap={spacing.xl}>
        <Col flex={2} minWidth={560}>
          <Card title="Costos y precios aprobados">
            <DataTable framed columns={columns} rows={rows} rowKey={(r) => r.productId} emptyText="Todavía no hay cotizaciones con precio aprobado." />
            <View style={styles.preview}>
              <Text style={styles.previewLabel}>Vista previa</Text>
              <Text style={styles.code}>{EXPORT_COLUMNS}</Text>
              {preview.slice(1).map((line) => (
                <Text key={line} style={[styles.code, styles.codeMuted]}>
                  {line}
                </Text>
              ))}
            </View>
            <View style={styles.exportActions}>
              <Text style={styles.muted}>
                {chosen.length} de {rows.length} seleccionados
              </Text>
              <Button title="Generar archivo CSV" icon="download" onPress={generate} disabled={!chosen.length} testID="generate-csv" />
            </View>
          </Card>
        </Col>
        <Col minWidth={320}>
          <Card title="Historial de exportaciones">
            {history.map((h) => (
              <View key={h.id} style={styles.historyRow}>
                <Icon name="file" color={colors.textMuted} size={20} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyTitle}>{formatDateTime(h.at)}</Text>
                  <Text style={styles.muted}>
                    {userName(db, h.userId)} · {h.productIds.length} productos
                  </Text>
                </View>
                <Pressable onPress={() => redownload(h.productIds, h.fileName)} accessibilityRole="button" accessibilityLabel={`Descargar ${h.fileName}`} hitSlop={8}>
                  <Icon name="download" color={colors.info} size={20} />
                </Pressable>
              </View>
            ))}
            <Note>Las transferencias a Dobra las autoriza la Administradora. El formato final se acordará en el spike SP-01.</Note>
          </Card>
        </Col>
      </Row>
    </>
  );
}

const styles = StyleSheet.create({
  step: { flex: 1, gap: 14 },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepDone: { backgroundColor: colors.success },
  stepNumber: { color: colors.onPrimary, fontWeight: font.weight.bold, fontSize: 14 },
  stepTitle: { fontSize: 17, fontWeight: font.weight.semibold, color: colors.text },
  text: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  leftAlign: { alignItems: 'flex-start' },
  samples: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' },
  sampleLabel: { fontSize: 12, color: colors.textMuted },
  sampleLink: { fontSize: 12, fontWeight: font.weight.medium },
  preview: { backgroundColor: colors.page, borderRadius: 8, padding: spacing.lg, gap: 4 },
  previewLabel: { fontSize: 12, color: colors.textMuted, fontWeight: font.weight.medium, marginBottom: 2 },
  code: { fontSize: 13, color: colors.text, fontFamily: Platform.OS === 'web' ? 'Consolas, monospace' : 'monospace' },
  codeMuted: { color: colors.textMuted },
  exportActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.lg },
  muted: { fontSize: 13, color: colors.textMuted },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  historyTitle: { fontSize: 15, fontWeight: font.weight.semibold, color: colors.text },
});
