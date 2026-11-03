// W-03 Materias primas e insumos (RF-05). Inactive materials stop being offered in new recipes.
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Segmented, SelectField } from '@/components/Inputs';
import { StatusBadge } from '@/components/StatusBadge';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { DataTable } from '@/components/web/DataTable';
import { Card, Col, Page, Row } from '@/components/web/Page';
import { materialTypeLabels, materialUnitLabels } from '@/domain/labels';
import type { Material, MaterialType, MaterialUnit } from '@/domain/types';
import { saveMaterial, setMaterialActive } from '@/store/actions';
import { useDataStore } from '@/store/data';
import { spacing } from '@/theme';

const TYPES = Object.keys(materialTypeLabels) as MaterialType[];
const UNITS = Object.keys(materialUnitLabels) as MaterialUnit[];
type Form = { id?: string; code: string; name: string; type?: MaterialType; unit?: MaterialUnit };

export default function MaterialsScreen() {
  const materials = useDataStore((s) => s.db.materials);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<MaterialType | 'all'>('all');
  const [form, setForm] = useState<Form>({ code: '', name: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const rows = materials.filter((m) => (typeFilter === 'all' || m.type === typeFilter) && `${m.code} ${m.name}`.toLowerCase().includes(search.trim().toLowerCase()));
  const set = (patch: Partial<Form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => ({ ...e, ...Object.fromEntries(Object.keys(patch).map((k) => [k, ''])) }));
  };
  const save = () => {
    const r = saveMaterial(form);
    if (!r.ok) {
      setErrors(r.errors);
      return showToast('error', 'Revise los campos marcados');
    }
    showToast('success', form.id ? 'Insumo actualizado' : `Insumo ${form.name.trim()} agregado al catálogo`);
    setForm({ code: '', name: '' });
  };
  const toggle = (m: Material) => {
    setMaterialActive(m.id, !m.active);
    showToast('success', m.active ? `${m.code} desactivado: ya no aparece en recetas nuevas` : `${m.code} reactivado`);
  };

  return (
    <Page>
      <Row>
        <Col minWidth={620} flex={2}>
          <Card padded={false}>
            <View style={{ padding: spacing.lg, gap: spacing.md }}>
              <Row align="flex-end">
                <View style={{ flex: 1, minWidth: 240 }}>
                  <TextField label="Buscar por nombre o código" value={search} onChangeText={setSearch} placeholder="Ej.: polietileno" testID="search" />
                </View>
                <View style={{ width: 220 }}>
                  <SelectField<MaterialType | 'all'> label="Tipo" value={typeFilter} onChange={setTypeFilter} options={[{ value: 'all', label: 'Todos los tipos' }, ...TYPES.map((t) => ({ value: t, label: materialTypeLabels[t] }))]} />
                </View>
              </Row>
            </View>
            <DataTable
              rows={rows}
              rowKey={(m) => m.id}
              selectedKey={form.id}
              emptyText="Ningún insumo coincide con la búsqueda."
              columns={[
                { key: 'code', title: 'Código', flex: 0.6, render: (m) => m.code },
                { key: 'name', title: 'Nombre', flex: 2, render: (m) => m.name },
                { key: 'type', title: 'Tipo', flex: 0.8, render: (m) => materialTypeLabels[m.type] },
                { key: 'unit', title: 'Unidad', flex: 0.6, render: (m) => materialUnitLabels[m.unit] },
                { key: 'state', title: 'Estado', flex: 0.7, render: (m) => <StatusBadge label={m.active ? 'Activo' : 'Inactivo'} tone={m.active ? 'success' : 'neutral'} /> },
                {
                  key: 'act',
                  title: '',
                  minWidth: 200,
                  render: (m) => (
                    <View style={{ flexDirection: 'row' }}>
                      <Button title="Editar" variant="ghost" onPress={() => { setErrors({}); setForm({ id: m.id, code: m.code, name: m.name, type: m.type, unit: m.unit }); }} />
                      <Button title={m.active ? 'Desactivar' : 'Reactivar'} variant="ghost" onPress={() => toggle(m)} />
                    </View>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
        <Col minWidth={340}>
          <Card title={form.id ? 'Editar insumo' : 'Nuevo insumo'}>
            <TextField label="Código" value={form.code} onChangeText={(t) => set({ code: t })} autoCapitalize="characters" error={errors.code} placeholder="Ej.: ADT-A" />
            <TextField label="Nombre" value={form.name} onChangeText={(t) => set({ name: t })} error={errors.name} testID="material-name" />
            <SelectField label="Tipo" value={form.type} onChange={(v) => set({ type: v })} options={TYPES.map((t) => ({ value: t, label: materialTypeLabels[t] }))} error={errors.type} />
            <Segmented label="Unidad de medida" value={form.unit} onChange={(v) => set({ unit: v })} options={UNITS.map((u) => ({ value: u, label: materialUnitLabels[u] }))} error={errors.unit} />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button title="Guardar" onPress={save} testID="save-material" />
              {form.id && <Button title="Cancelar" variant="ghost" onPress={() => setForm({ code: '', name: '' })} />}
            </View>
          </Card>
        </Col>
      </Row>
    </Page>
  );
}
