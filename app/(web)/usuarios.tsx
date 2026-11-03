// W-02 Usuarios y roles (RF-02, RF-03). Accounts and the read-only permission matrix (SRS Table 5.1).
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Segmented, SelectField, Tabs } from '@/components/Inputs';
import { StatusBadge } from '@/components/StatusBadge';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { DataTable } from '@/components/web/DataTable';
import { Card, Col, Page, Row } from '@/components/web/Page';
import { roleLabels, roleShortLabels } from '@/domain/labels';
import { featureLabels, permissionMatrix, type Feature } from '@/domain/permissions';
import type { Role, User } from '@/domain/types';
import { saveUser, setUserActive } from '@/store/actions';
import { useDataStore } from '@/store/data';
import { useCurrentUser } from '@/store/session';
import { colors, font, spacing } from '@/theme';

const ROLES = Object.keys(roleLabels) as Role[];
const EMPTY = { id: undefined as string | undefined, name: '', username: '', role: 'ope' as Role, active: 'yes' as 'yes' | 'no' };

export default function UsersScreen() {
  const me = useCurrentUser()!;
  const users = useDataStore((s) => s.db.users);
  const [tab, setTab] = useState<'users' | 'matrix'>('users');
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const edit = (u?: User) => {
    setErrors({});
    setForm(u ? { id: u.id, name: u.name, username: u.username, role: u.role, active: u.active ? 'yes' : 'no' } : EMPTY);
  };
  const save = () => {
    if (!form) return;
    const r = saveUser({ ...form, active: form.active === 'yes' });
    if (!r.ok) {
      setErrors(r.errors);
      return showToast('error', 'Revise los campos marcados');
    }
    showToast('success', form.id ? 'Usuario actualizado' : `Usuario ${form.username.trim().toLowerCase()} creado. Contraseña inicial: demo123`);
    setForm(null);
  };
  const toggle = (u: User) => {
    setUserActive(u.id, !u.active);
    showToast('success', `${u.name} ${u.active ? 'desactivado: no podrá iniciar sesión' : 'reactivado'}`);
  };

  return (
    <Page>
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'users', label: 'Usuarios' },
          { value: 'matrix', label: 'Matriz de permisos' },
        ]}
      />
      {tab === 'users' ? (
        <Row>
          <Col minWidth={620} flex={2}>
            <Card title="Cuentas" subtitle={`${users.filter((u) => u.active).length} activas de ${users.length}`} actions={<Button title="Nuevo usuario" icon="plus" onPress={() => edit()} testID="new-user" />} padded={false}>
              <DataTable
                rows={users}
                rowKey={(u) => u.id}
                selectedKey={form?.id}
                columns={[
                  { key: 'name', title: 'Nombre', flex: 1.3, render: (u) => u.name },
                  { key: 'username', title: 'Usuario', render: (u) => u.username },
                  { key: 'role', title: 'Rol', flex: 1.4, render: (u) => roleLabels[u.role] },
                  { key: 'state', title: 'Estado', flex: 0.7, render: (u) => <StatusBadge label={u.active ? 'Activo' : 'Inactivo'} tone={u.active ? 'success' : 'neutral'} /> },
                  {
                    key: 'act',
                    title: '',
                    flex: 1.4,
                    minWidth: 240,
                    render: (u) => (
                      <View style={styles.actions}>
                        <Button title="Editar" variant="ghost" onPress={() => edit(u)} />
                        {u.id !== me.id && <Button title={u.active ? 'Desactivar' : 'Reactivar'} variant="ghost" onPress={() => toggle(u)} testID={`toggle-${u.username}`} />}
                      </View>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>
          {form && (
            <Col minWidth={340}>
              <Card title={form.id ? 'Editar usuario' : 'Nuevo usuario'}>
                <TextField label="Nombres" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} error={errors.name} testID="user-name" />
                <TextField label="Usuario" value={form.username} onChangeText={(t) => setForm({ ...form, username: t })} autoCapitalize="none" error={errors.username} testID="user-username" />
                <SelectField label="Rol" value={form.role} onChange={(v) => setForm({ ...form, role: v })} options={ROLES.map((r) => ({ value: r, label: roleLabels[r] }))} testID="user-role" />
                <Segmented label="Estado" value={form.active} onChange={(v) => setForm({ ...form, active: v })} options={[{ value: 'yes', label: 'Activo' }, { value: 'no', label: 'Inactivo' }]} />
                <View style={styles.actions}>
                  <Button title="Guardar" onPress={save} testID="save-user" />
                  <Button title="Cancelar" variant="ghost" onPress={() => setForm(null)} />
                </View>
              </Card>
            </Col>
          )}
        </Row>
      ) : (
        <Card title="Matriz de permisos por rol" subtitle="Tabla 5.1 del SRS · X = acceso completo, C = solo consulta · solo lectura" padded={false}>
          <DataTable
            rows={Object.keys(featureLabels) as Feature[]}
            rowKey={(f) => f}
            columns={[
              { key: 'f', title: 'Función', flex: 2.4, minWidth: 260, render: (f) => featureLabels[f] },
              ...ROLES.map((r) => ({
                key: r,
                title: roleShortLabels[r],
                align: 'center' as const,
                minWidth: 80,
                flex: 0.6,
                render: (f: Feature) => {
                  const a = permissionMatrix[f][r];
                  return <Text style={[styles.cell, a === 'full' && styles.full]}>{a === 'full' ? 'X' : a === 'read' ? 'C' : ''}</Text>;
                },
              })),
            ]}
          />
        </Card>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing.xs },
  cell: { fontSize: font.size.md, color: colors.textMuted, fontWeight: font.weight.bold, textAlign: 'center' },
  full: { color: colors.primary },
});
