// W-03 Materias primas e insumos (RF-06): catalog used by formulas and reference prices.
// The code of an existing material is locked; deactivating keeps it in history and existing formulas.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { SelectField } from '@/components/Inputs';
import { StatusBadge } from '@/components/StatusBadge';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { DataTable, type Column } from '@/components/web/DataTable';
import { Card, Col, Note, Page, Row } from '@/components/web/Page';
import { materialTypeLabels, materialUnitLabels } from '@/domain/labels';
import type { Material, MaterialType, MaterialUnit } from '@/domain/types';
import type { FieldErrors } from '@/domain/validation';
import { formulasUsing, saveMaterial, setMaterialActive } from '@/store/actions';
import { useDataStore } from '@/store/data';
import { colors, font, spacing } from '@/theme';

type Form = { id?: string; code: string; name: string; type?: MaterialType; unit?: MaterialUnit };
const TYPES = Object.keys(materialTypeLabels) as MaterialType[];
const UNITS = Object.keys(materialUnitLabels) as MaterialUnit[];

export default function MaterialsScreen() {
  const db = useDataStore((s) => s.db);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<MaterialType | 'all'>('all');
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const q = query.trim().toLowerCase();
  const rows = db.materials.filter(
    (m) => (category === 'all' || m.type === category) && (!q || m.code.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)),
  );
  const editing = form?.id ? db.materials.find((m) => m.id === form.id) : undefined;
  const usage = editing ? formulasUsing(editing.id, db).length : 0;

  const open = (m?: Material) => {
    setForm(m ? { id: m.id, code: m.code, name: m.name, type: m.type, unit: m.unit } : { code: '', name: '' });
    setErrors({});
  };
  const set = (patch: Partial<Form>) => {
    setForm((f) => (f ? { ...f, ...patch } : f));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k];
      return next;
    });
  };

  const save = () => {
    if (!form) return;
    const result = saveMaterial(form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    showToast('success', editing ? `Insumo ${editing.code} actualizado.` : `Insumo ${form.code.trim().toUpperCase()} creado.`);
    if (!editing) setForm(null);
  };

  const toggleActive = () => {
    if (!editing) return;
    const result = setMaterialActive(editing.id, !editing.active);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    showToast('success', editing.active ? `${editing.code} desactivado: ya no se ofrece en fórmulas nuevas.` : `${editing.code} reactivado.`);
  };

  const columns: Column<Material>[] = [
    { key: 'code', title: 'Código', flex: 0.8, minWidth: 90, render: (m) => m.code },
    { key: 'name', title: 'Nombre', flex: 2, minWidth: 200, render: (m) => m.name },
    { key: 'type', title: 'Categoría', flex: 0.9, minWidth: 110, render: (m) => materialTypeLabels[m.type] },
    { key: 'unit', title: 'Unidad', flex: 0.6, minWidth: 80, render: (m) => materialUnitLabels[m.unit] },
    { key: 'status', title: 'Estado', flex: 0.7, minWidth: 90, render: (m) => <StatusBadge label={m.active ? 'Activo' : 'Inactivo'} tone={m.active ? 'success' : 'neutral'} /> },
  ];

  return (
    <Page
      title="Materias primas e insumos"
      subtitle="Materiales que usan las fórmulas y los precios de referencia"
      actions={<Button title="Nuevo insumo" onPress={() => open()} testID="new-material" />}
      testID="screen-W-03"
    >
      <Row gap={spacing.xl}>
        <Col flex={2} minWidth={520}>
          <View style={styles.filters}>
            <View style={{ width: 300 }}>
              <TextField label="Buscar" value={query} onChangeText={setQuery} placeholder="Nombre o código" testID="material-search" />
            </View>
            <View style={{ width: 200 }}>
              <SelectField
                label="Categoría"
                value={category}
                options={[{ value: 'all', label: 'Todas' }, ...TYPES.map((t) => ({ value: t, label: materialTypeLabels[t] }))]}
                onChange={setCategory}
              />
            </View>
          </View>
          <DataTable
            framed
            columns={columns}
            rows={rows}
            rowKey={(m) => m.id}
            selectedKey={form?.id}
            onRowPress={open}
            emptyText="Ningún insumo coincide con la búsqueda."
            testID="materials-table"
          />
        </Col>
        {form && (
          <Col minWidth={320}>
            <Card>
              <Text style={styles.panelTitle}>{editing ? `Editar · ${editing.code}` : 'Nuevo insumo'}</Text>
              <TextField
                label="Código"
                value={form.code}
                onChangeText={(code) => set({ code })}
                editable={!editing}
                autoCapitalize="characters"
                error={errors.code}
                hint={editing ? 'No cambia porque lo usan las fórmulas.' : 'Por ejemplo ADT-02. No podrá cambiarlo después.'}
                trailing={editing ? <Icon name="lock" color={colors.textMuted} size={16} /> : undefined}
                testID="material-code"
              />
              <TextField label="Nombre" value={form.name} onChangeText={(name) => set({ name })} error={errors.name} testID="material-name" />
              <SelectField
                label="Categoría"
                value={form.type}
                placeholder="Elija la categoría"
                options={TYPES.map((t) => ({ value: t, label: materialTypeLabels[t] }))}
                onChange={(type) => set({ type })}
                error={errors.type}
              />
              <SelectField
                label="Unidad"
                value={form.unit}
                placeholder="Elija la unidad"
                options={UNITS.map((u) => ({ value: u, label: materialUnitLabels[u] }))}
                onChange={(unit) => set({ unit })}
                error={errors.unit}
              />
              {editing &&
                (editing.active ? (
                  <Note>
                    {usage > 0
                      ? `Se usa en ${usage} ${usage === 1 ? 'fórmula habilitada' : 'fórmulas habilitadas'}. Si lo desactiva, no aparecerá en fórmulas nuevas.`
                      : 'No se usa en fórmulas habilitadas. Si lo desactiva, no aparecerá en fórmulas nuevas.'}
                  </Note>
                ) : (
                  <Note tone="warning">Insumo inactivo: se conserva en el historial y en las fórmulas existentes.</Note>
                ))}
              <View style={styles.actions}>
                {editing ? (
                  <Button title={editing.active ? 'Desactivar' : 'Reactivar'} variant="secondary" onPress={toggleActive} testID="toggle-material" />
                ) : (
                  <Button title="Cancelar" variant="secondary" onPress={() => setForm(null)} />
                )}
                <Button title="Guardar" onPress={save} testID="save-material" />
              </View>
            </Card>
          </Col>
        )}
      </Row>
    </Page>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' },
  panelTitle: { fontSize: 17, fontWeight: font.weight.semibold, color: colors.text },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md },
});
