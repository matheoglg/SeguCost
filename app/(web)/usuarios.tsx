// W-02 Usuarios y roles (RF-03, RF-04, RF-05): accounts with one of the four business roles.
// Accounts are never deleted: deactivating blocks the login and keeps the history.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, LinkButton } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { SelectField, Tabs } from '@/components/Inputs';
import { StatusBadge } from '@/components/StatusBadge';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { DataTable, type Column } from '@/components/web/DataTable';
import { Card, Col, Note, Page, Row } from '@/components/web/Page';
import { ROLES, roleLabels } from '@/domain/labels';
import { featureLabels, permissionMatrix, type Feature } from '@/domain/permissions';
import type { Role, User } from '@/domain/types';
import type { FieldErrors } from '@/domain/validation';
import { resetPassword, saveUser } from '@/store/actions';
import { useDataStore } from '@/store/data';
import { useCurrentUser } from '@/store/session';
import { colors, font, spacing } from '@/theme';

type Form = { id?: string; name: string; username: string; role?: Role; active: boolean };
const EMPTY: Form = { name: '', username: '', role: undefined, active: true };

export default function UsersScreen() {
  const me = useCurrentUser()!;
  const users = useDataStore((s) => s.db.users);
  const [tab, setTab] = useState<'accounts' | 'permissions'>('accounts');
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const open = (f: Form) => {
    setForm(f);
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
    if (form.id === me.id && !form.active) {
      setErrors({ active: 'No puede desactivar su propia cuenta.' });
      return;
    }
    const result = saveUser(form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    showToast('success', form.id ? `Cuenta ${form.username.trim().toLowerCase()} actualizada.` : `Cuenta ${form.username.trim().toLowerCase()} creada. Contraseña temporal: demo123.`);
    setForm(null);
  };

  const columns: Column<User>[] = [
    { key: 'name', title: 'Nombre', flex: 1.4, minWidth: 160, render: (u) => u.name },
    { key: 'username', title: 'Usuario', flex: 1, minWidth: 110, render: (u) => u.username },
    { key: 'role', title: 'Rol', flex: 1.6, minWidth: 190, render: (u) => roleLabels[u.role] },
    {
      key: 'status',
      title: 'Estado',
      flex: 0.8,
      minWidth: 100,
      render: (u) => <StatusBadge label={u.active ? 'Activa' : 'Inactiva'} tone={u.active ? 'success' : 'neutral'} />,
    },
  ];

  return (
    <Page
      title="Usuarios y roles"
      subtitle="Cuentas del personal con uno de los cuatro roles de SeguCost"
      actions={tab === 'accounts' && <Button title="Nueva cuenta" onPress={() => open(EMPTY)} testID="new-account" />}
      testID="screen-W-02"
    >
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'accounts', label: `Cuentas (${users.length})` },
          { value: 'permissions', label: 'Permisos por rol' },
        ]}
      />
      {tab === 'accounts' ? (
        <Row gap={spacing.xl}>
          <Col flex={1.8} minWidth={520}>
            <DataTable
              framed
              columns={columns}
              rows={users}
              rowKey={(u) => u.id}
              selectedKey={form?.id}
              onRowPress={(u) => open({ id: u.id, name: u.name, username: u.username, role: u.role, active: u.active })}
              testID="accounts-table"
            />
          </Col>
          {form && (
            <Col minWidth={340}>
              <Card>
                <View style={styles.panelHead}>
                  <Text style={styles.panelTitle}>{form.id ? 'Editar cuenta' : 'Nueva cuenta'}</Text>
                  <Pressable onPress={() => setForm(null)} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={8}>
                    <Icon name="close" color={colors.textMuted} size={20} />
                  </Pressable>
                </View>
                <TextField label="Nombres completos" value={form.name} onChangeText={(name) => set({ name })} error={errors.name} testID="account-name" />
                <TextField
                  label="Usuario"
                  value={form.username}
                  onChangeText={(username) => set({ username })}
                  autoCapitalize="none"
                  error={errors.username}
                  hint={form.id ? undefined : 'Con este usuario ingresará a SeguCost.'}
                  testID="account-username"
                />
                <SelectField
                  label="Rol"
                  value={form.role}
                  placeholder="Elija un rol"
                  options={ROLES.map((r) => ({ value: r, label: roleLabels[r] }))}
                  onChange={(role) => set({ role })}
                  error={errors.role}
                  hint="Define los menús y acciones que verá."
                  testID="account-role"
                />
                <SelectField
                  label="Estado"
                  value={form.active ? 'active' : 'inactive'}
                  options={[
                    { value: 'active', label: 'Activa' },
                    { value: 'inactive', label: 'Inactiva', detail: 'No puede ingresar; sus registros se conservan.' },
                  ]}
                  onChange={(v) => set({ active: v === 'active' })}
                  error={errors.active}
                  testID="account-status"
                />
                {form.id && (
                  <LinkButton
                    title="Restablecer contraseña"
                    onPress={() => {
                      resetPassword(form.id!);
                      showToast('success', `Contraseña de ${form.username} restablecida a demo123. Deberá cambiarla al ingresar.`);
                    }}
                  />
                )}
                <View style={styles.panelActions}>
                  <Button title="Cancelar" variant="secondary" onPress={() => setForm(null)} />
                  <Button title="Guardar cuenta" onPress={save} testID="save-account" />
                </View>
              </Card>
            </Col>
          )}
        </Row>
      ) : (
        <PermissionsMatrix />
      )}
    </Page>
  );
}

/** Table 6.1 of the SRS, read only (RF-04). */
function PermissionsMatrix() {
  const features = Object.keys(permissionMatrix) as Feature[];
  const cell = (f: Feature, r: Role) => {
    const a = permissionMatrix[f][r];
    return a ? <StatusBadge label={a === 'full' ? 'Completo' : 'Consulta'} tone={a === 'full' ? 'success' : 'info'} /> : <Text style={styles.none}>—</Text>;
  };
  const columns: Column<Feature>[] = [
    { key: 'feature', title: 'Función', flex: 2.4, minWidth: 260, render: (f) => featureLabels[f] },
    ...ROLES.map((r) => ({ key: r, title: roleLabels[r], flex: 1, minWidth: 150, render: (f: Feature) => cell(f, r) })),
  ];
  return (
    <View style={{ gap: spacing.lg }}>
      <Note>Cada usuario ve solo los menús y datos de su rol. El Operario usa solo la aplicación móvil y nunca ve costos ni ganancias.</Note>
      <DataTable framed columns={columns} rows={features} rowKey={(f) => f} />
    </View>
  );
}

const styles = StyleSheet.create({
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  panelTitle: { fontSize: 17, fontWeight: font.weight.semibold, color: colors.text },
  panelActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.xs },
  none: { color: colors.textMuted, fontSize: 15 },
});
