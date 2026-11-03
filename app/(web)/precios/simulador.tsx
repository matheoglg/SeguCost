// W-16 Simulador de márgenes (RF-36, RF-37). Compare up to three margins; simulating never changes the price in force.
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Segmented, SelectField } from '@/components/Inputs';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { Card, Field, Note, Page, Row } from '@/components/web/Page';
import { standardCost } from '@/domain/costing';
import { belowMinimum, currentReferencePrice, priceFromMargin, profit } from '@/domain/pricing';
import type { MarginMethod } from '@/domain/types';
import { formatMoney, formatNumber, formatPercent, formatUnitCost, parseNumber } from '@/format';
import { proposePrice, updateSettings } from '@/store/actions';
import { useDataStore } from '@/store/data';
import { useCurrentUser } from '@/store/session';
import { useUiStore } from '@/store/ui';
import { colors, font, radius, spacing } from '@/theme';

const METHOD_LABEL: Record<MarginMethod, string> = { onCost: 'Sobre costo: P = CU × (1 + m)', onPrice: 'Sobre precio: P = CU ÷ (1 − m)' };

export default function MarginSimulatorScreen() {
  const user = useCurrentUser()!;
  const db = useDataStore((s) => s.db);
  const preset = useUiStore((s) => s.simulatorPreset);
  const now = new Date().toISOString();
  const [productId, setProductId] = useState(preset?.productId ?? db.products[0].id);
  const presetApplies = preset && preset.productId === productId;
  const baseCost = presetApplies ? preset.unitCost : standardCost(db, productId, now).unitCost;
  const [cost, setCost] = useState(formatNumber(baseCost, 4));
  const [quantity, setQuantity] = useState('10.000');
  const [margins, setMargins] = useState(['15', '25', '30']);
  useEffect(() => setCost(formatNumber(baseCost, 4)), [baseCost]);

  const product = db.products.find((p) => p.id === productId)!;
  const line = db.productLines.find((l) => l.id === product.lineId)!;
  const method = db.settings.marginMethod;
  const unitCost = parseNumber(cost);
  const qty = parseNumber(quantity);
  const reference = currentReferencePrice(db.priceProposals, productId);

  const propose = (margin: number, price: number) => {
    const r = proposePrice({ productId, baseUnitCost: unitCost, margin, method, price, quantity: qty > 0 ? qty : undefined });
    if (!r.ok) return showToast('error', Object.values(r.errors)[0]);
    showToast('success', `Propuesta de ${formatUnitCost(price)} para ${product.code} enviada a aprobación`);
  };

  return (
    <Page>
      <Row align="flex-end">
        <View style={{ width: 400 }}>
          <SelectField label="Funda" value={productId} onChange={setProductId} options={db.products.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))} testID="sim-product" />
        </View>
        <View style={{ width: 200 }}>
          <TextField label="Costo unitario (USD)" value={cost} onChangeText={setCost} keyboardType="decimal-pad" testID="sim-cost" />
        </View>
        <View style={{ width: 180 }}>
          <TextField label="Cantidad del pedido" value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
        </View>
      </Row>
      <Card>
        <Row gap={spacing.xl}>
          <Field label="Costo base" value={presetApplies ? `Real de ${preset.source}` : 'Costo estándar vigente'} />
          <Field label="Línea" value={`${line.name} · mínimo ${formatPercent(line.minMargin, 0)}`} />
          <Field label="Precio referencial vigente" value={reference ? formatUnitCost(reference.price) : 'Sin precio aprobado'} />
          <View style={{ gap: 4 }}>
            <Text style={styles.fieldLabel}>Método</Text>
            {user.role === 'adm' ? (
              <Segmented<MarginMethod> value={method} onChange={(m) => updateSettings({ marginMethod: m })} options={[{ value: 'onCost', label: 'Sobre costo' }, { value: 'onPrice', label: 'Sobre precio' }]} />
            ) : (
              <Text style={styles.fieldValue}>{method === 'onCost' ? 'Sobre costo' : 'Sobre precio'} (configuración)</Text>
            )}
          </View>
        </Row>
        <Text style={styles.muted}>{METHOD_LABEL[method]}</Text>
      </Card>

      <Row>
        {margins.map((m, i) => {
          const margin = parseNumber(m) / 100;
          const valid = unitCost > 0 && margin > 0 && margin < 1;
          const price = valid ? priceFromMargin(unitCost, margin, method) : NaN;
          const gain = valid ? profit(price, unitCost, qty > 0 ? qty : 0) : undefined;
          const below = valid && belowMinimum(margin, line.minMargin);
          return (
            <View key={i} style={[styles.column, below && styles.columnBelow]} testID={`margin-col-${i}`}>
              <Text style={styles.colTitle}>Opción {i + 1}</Text>
              <TextField label="Margen (%)" value={m} onChangeText={(t) => setMargins((ms) => ms.map((x, j) => (j === i ? t : x)))} keyboardType="decimal-pad" testID={`margin-${i}`} />
              <Text style={styles.fieldLabel}>Precio de venta por unidad</Text>
              <Text style={styles.price}>{valid ? formatUnitCost(price) : '—'}</Text>
              <Field label="Ganancia por unidad" value={gain ? formatUnitCost(gain.perUnit) : '—'} />
              <Field label={`Ganancia por pedido (${qty > 0 ? formatNumber(qty) : 0} u)`} value={gain ? formatMoney(gain.perOrder) : '—'} />
              {below ? <Note tone="alert">Bajo el mínimo de la línea ({formatPercent(line.minMargin, 0)}): la aprobación exigirá justificación.</Note> : <View style={{ height: 0 }} />}
              <Button title="Proponer este precio" variant={below ? 'secondary' : 'primary'} disabled={!valid} onPress={() => propose(margin, price)} testID={`propose-${i}`} />
            </View>
          );
        })}
      </Row>
      <Note tone="info">La simulación no cambia el precio vigente. Una propuesta queda pendiente hasta que la Administradora la apruebe.</Note>
    </Page>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: font.size.sm, color: colors.textMuted },
  fieldLabel: { fontSize: 12, color: colors.textMuted, fontWeight: font.weight.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldValue: { fontSize: font.size.md, color: colors.text },
  column: { flex: 1, minWidth: 260, backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, borderTopWidth: 4, borderTopColor: colors.primary, padding: spacing.lg, gap: spacing.md },
  columnBelow: { borderColor: colors.alert, borderTopColor: colors.alert },
  colTitle: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.text },
  price: { fontSize: 32, fontWeight: font.weight.bold, color: colors.primary, fontVariant: ['tabular-nums'] },
});
