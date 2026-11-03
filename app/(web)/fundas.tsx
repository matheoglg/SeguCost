// W-04 Fundas (RF-06). Product catalog; the type decides the stage route.
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Segmented, SelectField } from '@/components/Inputs';
import { RoutePreview } from '@/components/RoutePreview';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { DataTable } from '@/components/web/DataTable';
import { Card, Col, Page, Row } from '@/components/web/Page';
import { productTypeLabels } from '@/domain/labels';
import { can } from '@/domain/permissions';
import type { Product, ProductType } from '@/domain/types';
import { formatNumber, parseNumber } from '@/format';
import { go } from '@/navigation/go';
import { saveProduct } from '@/store/actions';
import { useDataStore } from '@/store/data';
import { useCurrentUser } from '@/store/session';
import { colors, font, spacing } from '@/theme';

const TYPES = Object.keys(productTypeLabels) as ProductType[];
type Form = { id?: string; code: string; name: string; width: string; length: string; gauge: string; weight: string; type?: ProductType; lineId?: string };
const EMPTY: Form = { code: '', name: '', width: '', length: '', gauge: '', weight: '' };
const num = (n: number) => formatNumber(n, n % 1 ? 1 : 0);

export default function ProductsScreen() {
  const user = useCurrentUser()!;
  const db = useDataStore((s) => s.db);
  const canEdit = can(user.role, 'catalog', 'full');
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const edit = (p: Product) => {
    setErrors({});
    setForm({ id: p.id, code: p.code, name: p.name, width: num(p.widthCm), length: num(p.lengthCm), gauge: num(p.gauge), weight: num(p.weightG), type: p.type, lineId: p.lineId });
  };
  const save = () => {
    const r = saveProduct({
      id: form.id,
      code: form.code,
      name: form.name,
      widthCm: parseNumber(form.width),
      lengthCm: parseNumber(form.length),
      gauge: parseNumber(form.gauge),
      weightG: parseNumber(form.weight),
      type: form.type,
      lineId: form.lineId,
    });
    if (!r.ok) {
      setErrors(r.errors);
      return showToast('error', 'Revise los campos marcados');
    }
    showToast('success', `Funda ${form.code.trim().toUpperCase()} guardada`);
    setForm(EMPTY);
  };

  return (
    <Page>
      <Row>
        <Col minWidth={640} flex={2}>
          <Card title="Catálogo de fundas" padded={false}>
            <DataTable
              rows={db.products}
              rowKey={(p) => p.id}
              selectedKey={form.id}
              columns={[
                { key: 'code', title: 'Código', flex: 0.7, render: (p) => p.code },
                { key: 'name', title: 'Nombre', flex: 2, render: (p) => p.name },
                { key: 'size', title: 'Medidas', flex: 0.8, render: (p) => `${num(p.widthCm)} x ${num(p.lengthCm)} cm` },
                { key: 'gauge', title: 'Calibre', align: 'right', flex: 0.5, render: (p) => formatNumber(p.gauge, 1) },
                { key: 'weight', title: 'Peso', align: 'right', flex: 0.6, render: (p) => `${formatNumber(p.weightG, 1)} g` },
                { key: 'type', title: 'Tipo', flex: 0.6, render: (p) => productTypeLabels[p.type] },
                { key: 'line', title: 'Línea', flex: 1, render: (p) => db.productLines.find((l) => l.id === p.lineId)?.name ?? '—' },
                {
                  key: 'act',
                  title: '',
                  minWidth: 210,
                  render: (p) => (
                    <View style={{ flexDirection: 'row' }}>
                      <Button title="Ver receta" variant="ghost" onPress={() => go(`/recetas/${p.id}`)} testID={`recipe-${p.code}`} />
                      {canEdit && <Button title="Editar" variant="ghost" onPress={() => edit(p)} />}
                    </View>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
        {canEdit && (
          <Col minWidth={360}>
            <Card title={form.id ? 'Editar funda' : 'Nueva funda'}>
              <Row gap={spacing.md}>
                <View style={{ flex: 1, minWidth: 120 }}>
                  <TextField label="Código" value={form.code} onChangeText={(t) => set({ code: t })} autoCapitalize="characters" error={errors.code} />
                </View>
                <View style={{ flex: 2, minWidth: 180 }}>
                  <TextField label="Nombre" value={form.name} onChangeText={(t) => set({ name: t })} error={errors.name} />
                </View>
              </Row>
              <Row gap={spacing.md}>
                {(
                  [
                    ['width', 'Ancho (cm)', 'widthCm'],
                    ['length', 'Largo (cm)', 'lengthCm'],
                    ['gauge', 'Calibre', 'gauge'],
                    ['weight', 'Peso (g)', 'weightG'],
                  ] as const
                ).map(([key, label, err]) => (
                  <View key={key} style={{ flex: 1, minWidth: 90 }}>
                    <TextField label={label} value={form[key]} onChangeText={(t) => set({ [key]: t })} keyboardType="decimal-pad" error={errors[err]} testID={`product-${key}`} />
                  </View>
                ))}
              </Row>
              <Segmented label="Tipo" value={form.type} onChange={(v) => set({ type: v })} options={TYPES.map((t) => ({ value: t, label: productTypeLabels[t] }))} error={errors.type} testID="product-type" />
              <SelectField label="Línea" value={form.lineId} onChange={(v) => set({ lineId: v })} options={db.productLines.map((l) => ({ value: l.id, label: l.name, detail: `Margen mínimo ${formatNumber(l.minMargin * 100)} %` }))} error={errors.lineId} />
              <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.text }}>Ruta de etapas</Text>
              {form.type ? <RoutePreview type={form.type} /> : <Text style={{ color: colors.textMuted, fontSize: font.size.sm }}>Elija el tipo para ver la ruta.</Text>}
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button title="Guardar" onPress={save} testID="save-product" />
                {form.id && <Button title="Cancelar" variant="ghost" onPress={() => setForm(EMPTY)} />}
              </View>
            </Card>
          </Col>
        )}
      </Row>
    </Page>
  );
}
