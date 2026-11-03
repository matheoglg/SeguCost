// W-12 Comparador local vs. importado (RF-28). Difference measured over the best local price.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { SelectField } from '@/components/Inputs';
import { StatusBadge } from '@/components/StatusBadge';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { DataTable } from '@/components/web/DataTable';
import { Card, Col, Note, Page, Row } from '@/components/web/Page';
import { materialUnitLabels, originLabels } from '@/domain/labels';
import { quotesFor } from '@/domain/prices';
import { suggestPurchase } from '@/domain/pricing';
import { formatMoney, formatNumber, formatPercent, parseNumber } from '@/format';
import { updateSettings } from '@/store/actions';
import { useDataStore } from '@/store/data';
import { useCurrentUser } from '@/store/session';
import { colors, font, radius, spacing } from '@/theme';

export default function PriceComparisonScreen() {
  const user = useCurrentUser()!;
  const db = useDataStore((s) => s.db);
  const now = new Date().toISOString();
  const comparable = db.materials.filter((m) => {
    const q = quotesFor(db.supplierPrices, db.suppliers, m.id, now);
    return m.active && q.some((x) => x.supplier.origin === 'imported') && q.some((x) => x.supplier.origin !== 'imported');
  });
  const [materialId, setMaterialId] = useState(comparable[0]?.id);
  const [threshold, setThreshold] = useState(formatNumber(db.settings.localImportThreshold * 100));

  const material = db.materials.find((m) => m.id === materialId);
  const quotes = materialId ? quotesFor(db.supplierPrices, db.suppliers, materialId, now).sort((a, b) => a.price.price - b.price.price) : [];
  const best = (imported: boolean) => quotes.filter((q) => (q.supplier.origin === 'imported') === imported)[0];
  const local = best(false);
  const imported = best(true);
  const t = parseNumber(threshold) / 100;
  const result = local && imported && t >= 0 ? suggestPurchase(local.price.price, imported.price.price, t) : undefined;
  const unit = material ? materialUnitLabels[material.unit] : '';

  return (
    <Page intro="Compara el mejor precio local con el mejor importado. Si la diferencia es menor que el umbral, conviene comprar local y evitar el tiempo de llegada.">
      <Row align="flex-end">
        <View style={{ width: 420 }}>
          <SelectField label="Materia prima" value={materialId} onChange={setMaterialId} options={comparable.map((m) => ({ value: m.id, label: `${m.code} · ${m.name}` }))} testID="compare-material" />
        </View>
        <View style={{ width: 180 }}>
          <TextField label="Umbral (%)" value={threshold} onChangeText={setThreshold} keyboardType="decimal-pad" testID="threshold" error={!(t >= 0) ? 'Ingrese un porcentaje' : undefined} />
        </View>
        {user.role === 'adm' && (
          <Button
            title="Guardar como umbral por defecto"
            variant="secondary"
            onPress={() => {
              if (!(t >= 0)) return;
              updateSettings({ localImportThreshold: t });
              showToast('success', `Umbral por defecto: ${formatPercent(t)}`);
            }}
          />
        )}
      </Row>

      <Row>
        <Col minWidth={560} flex={1.6}>
          <Card title="Precios vigentes" subtitle="La opción de menor precio aparece resaltada" padded={false}>
            <DataTable
              rows={quotes}
              rowKey={(q) => q.price.id}
              highlight={(q) => (q === quotes[0] ? 'success' : undefined)}
              columns={[
                { key: 's', title: 'Proveedor', flex: 1.6, render: (q) => q.supplier.name },
                { key: 'o', title: 'Origen', render: (q) => originLabels[q.supplier.origin] },
                { key: 'p', title: 'Precio', align: 'right', render: (q) => `${formatMoney(q.price.price)}/${unit}` },
                { key: 'd', title: 'Días de llegada', align: 'right', render: (q) => (q.price.leadTimeDays ? `${q.price.leadTimeDays} días` : 'Inmediato') },
              ]}
            />
          </Card>
        </Col>
        <Col minWidth={340}>
          <Card title="Sugerencia de compra">
            {result && local && imported ? (
              <>
                <View style={styles.compare}>
                  <View style={styles.side}>
                    <Text style={styles.label}>Mejor local</Text>
                    <Text style={styles.price}>{formatMoney(local.price.price)}</Text>
                    <Text style={styles.muted}>{local.supplier.name}</Text>
                  </View>
                  <View style={styles.side}>
                    <Text style={styles.label}>Mejor importado</Text>
                    <Text style={styles.price}>{formatMoney(imported.price.price)}</Text>
                    <Text style={styles.muted}>
                      {imported.supplier.name} · {imported.price.leadTimeDays} días
                    </Text>
                  </View>
                </View>
                <View style={styles.diff}>
                  <Text style={styles.label}>Diferencia sobre el precio local</Text>
                  <Text style={styles.diffValue} testID="difference">
                    {formatPercent(result.difference)}
                  </Text>
                  <Text style={styles.muted}>Umbral configurado: {formatPercent(t)}</Text>
                </View>
                <StatusBadge label={result.suggestion === 'local' ? 'Comprar local' : 'Evaluar importación'} tone={result.suggestion === 'local' ? 'success' : 'warning'} large />
                <Text style={styles.muted}>
                  {result.suggestion === 'local'
                    ? `El ahorro de importar (${formatPercent(result.difference)}) no supera el umbral; comprar local evita esperar ${imported.price.leadTimeDays} días.`
                    : `Importar ahorra ${formatPercent(result.difference)}, por encima del umbral. Evalúe si el plazo de ${imported.price.leadTimeDays} días es aceptable.`}
                </Text>
              </>
            ) : (
              <Note tone="info">Seleccione una materia prima con precios local e importado.</Note>
            )}
          </Card>
        </Col>
      </Row>
    </Page>
  );
}

const styles = StyleSheet.create({
  compare: { flexDirection: 'row', gap: spacing.md },
  side: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  label: { fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.textMuted },
  price: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.text },
  muted: { fontSize: font.size.sm, color: colors.textMuted },
  diff: { gap: 2 },
  diffValue: { fontSize: 32, fontWeight: font.weight.bold, color: colors.primary },
});
