// P-01 Inicio de sesión (RF-01, RF-03). One entry point; the role decides web panel or mobile app.
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { TextField } from '@/components/TextField';
import { DEMO_PASSWORD, QUICK_ACCESS_USERNAMES } from '@/data/seed';
import { roleLabels } from '@/domain/labels';
import { homePath } from '@/navigation/screens';
import { useIsWide } from '@/navigation/useIsWide';
import { useDataStore } from '@/store/data';
import { useSessionStore } from '@/store/session';
import { colors, font, radius, spacing } from '@/theme';

const PLATFORM_HINT: Record<string, string> = {
  supervisor: 'Web y móvil',
  operario1: 'Móvil · extrusión',
  operario2: 'Móvil · sellado y empacado',
};

export default function LoginScreen() {
  const isWide = useIsWide();
  const insets = useSafeAreaInsets();
  const users = useDataStore((s) => s.db.users);
  const login = useSessionStore((s) => s.login);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [missing, setMissing] = useState<{ username?: string; password?: string }>({});

  const enter = (u: string, p: string) => {
    const result = login(u, p);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError('');
    router.replace(homePath(result.user.role, isWide) as Href);
  };

  const submit = () => {
    const next = {
      username: username.trim() ? undefined : 'Ingrese su usuario',
      password: password ? undefined : 'Ingrese su contraseña',
    };
    setMissing(next);
    if (next.username || next.password) return;
    enter(username, password);
  };

  const quickUsers = QUICK_ACCESS_USERNAMES.map((name) => users.find((u) => u.username === name)!).filter(Boolean);

  const form = (
    <View style={[styles.card, isWide && styles.cardWide]}>
      <Text style={styles.title}>Iniciar sesión</Text>
      <TextField
        label="Usuario"
        value={username}
        onChangeText={(t) => {
          setUsername(t);
          setMissing((m) => ({ ...m, username: undefined }));
        }}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        error={missing.username}
        onSubmitEditing={submit}
        large={!isWide}
        testID="login-username"
      />
      <TextField
        label="Contraseña"
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          setMissing((m) => ({ ...m, password: undefined }));
        }}
        secureTextEntry
        autoComplete="password"
        error={missing.password}
        onSubmitEditing={submit}
        large={!isWide}
        testID="login-password"
      />
      {!!error && (
        <View style={styles.errorBox} accessibilityRole="alert">
          <Icon name="alert" color={colors.alert} size={18} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <Button title="Ingresar" onPress={submit} size={isWide ? 'md' : 'lg'} fullWidth testID="login-submit" />

      <View style={styles.quick}>
        <Text style={styles.quickTitle}>Accesos rápidos de demostración</Text>
        <Text style={styles.quickHint}>Contraseña de todos los usuarios: {DEMO_PASSWORD}</Text>
        <View style={styles.quickGrid}>
          {quickUsers.map((u) => (
            <Pressable
              key={u.id}
              testID={`quick-${u.username}`}
              accessibilityRole="button"
              accessibilityLabel={`Ingresar como ${u.name}, ${roleLabels[u.role]}`}
              onPress={() => enter(u.username, DEMO_PASSWORD)}
              style={({ pressed }) => [styles.quickItem, isWide && styles.quickItemWide, pressed && styles.quickPressed]}
            >
              <View style={styles.quickBody}>
                <Text style={[styles.quickRole, !isWide && styles.quickNarrowText]}>{roleLabels[u.role]}</Text>
                <Text style={[styles.quickUser, !isWide && styles.quickNarrowText]}>
                  {u.username} · {PLATFORM_HINT[u.username] ?? 'Web'}
                </Text>
              </View>
              <Icon name="chevronRight" color={colors.primary} size={18} />
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );

  if (isWide) {
    return (
      <View style={styles.wide}>
        <View style={styles.brand}>
          <Logo inverted size={52} />
          <View style={styles.brandText}>
            <Text style={styles.brandHeadline}>Costeo y control de producción</Text>
            <Text style={styles.brandBody}>
              Del pedido a la orden de producción, el registro en planta, el costo real de cada orden y el precio
              referencial aprobado, en un solo sistema.
            </Text>
          </View>
          <Text style={styles.brandFoot}>Prototipo con datos simulados · Equipo T4 · ESPOL</Text>
        </View>
        <ScrollView style={styles.formSide} contentContainerStyle={styles.formSideContent}>
          {form}
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView style={styles.narrow} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
      <View style={[styles.narrowHeader, { paddingTop: insets.top + spacing.xl }]}>
        <Logo inverted size={44} />
        <Text style={styles.narrowTagline}>Costeo y control de producción</Text>
      </View>
      {form}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wide: { flex: 1, flexDirection: 'row', backgroundColor: colors.background },
  brand: { flex: 1, backgroundColor: colors.primary, padding: 56, justifyContent: 'space-between' },
  brandText: { gap: spacing.lg, maxWidth: 520 },
  brandHeadline: { color: colors.onPrimary, fontSize: 40, fontWeight: font.weight.bold, lineHeight: 48 },
  brandBody: { color: '#D5DEEA', fontSize: font.size.lg, lineHeight: 28 },
  brandFoot: { color: '#B9C6D8', fontSize: font.size.sm },
  formSide: { flex: 1 },
  formSideContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },

  narrow: { flex: 1, backgroundColor: colors.surface },
  narrowHeader: { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingBottom: 56, gap: spacing.sm },
  narrowTagline: { color: '#D5DEEA', fontSize: font.size.md },

  card: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: -40,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardWide: { width: 460, marginHorizontal: 0, marginTop: 0, borderWidth: 0, padding: 0 },
  title: { fontSize: font.size.xxl, fontWeight: font.weight.bold, color: colors.primary },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.alertBg,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  errorText: { color: colors.alert, fontSize: font.size.md, fontWeight: font.weight.medium },

  quick: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg },
  quickTitle: { fontSize: font.size.md, fontWeight: font.weight.bold, color: colors.text },
  quickHint: { fontSize: font.size.sm, color: colors.textMuted },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    width: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  quickItemWide: { width: '48.5%' },
  quickPressed: { backgroundColor: colors.border },
  quickBody: { flex: 1, gap: 2 },
  quickRole: { fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.primary },
  quickUser: { fontSize: 13, color: colors.textMuted },
  quickNarrowText: { fontSize: font.size.md },
});
