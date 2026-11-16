// P-01 Inicio de sesión (RF-01, RF-02, RF-03). One entry point; the role decides web panel or mobile app.
// Web: brand panel + card. Phone: blue header, error banner and «Recordar usuario en este celular».
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, LinkButton } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import { Checkbox } from '@/components/Inputs';
import { Logo, Mark } from '@/components/Logo';
import { TextField } from '@/components/TextField';
import { DEMO_PASSWORD, QUICK_ACCESS_MOBILE, QUICK_ACCESS_WEB } from '@/data/seed';
import type { User } from '@/domain/types';
import { homePath } from '@/navigation/screens';
import { useIsWide } from '@/navigation/useIsWide';
import { changePassword } from '@/store/actions';
import { LOGIN_ERROR, useSessionStore } from '@/store/session';
import { colors, font, radius, spacing } from '@/theme';

/** Only the username is kept on the phone; the password never is (RF-01). */
const REMEMBER_KEY = 'segucost.rememberedUser';

const BENEFITS: { icon: IconName; text: string }[] = [
  { icon: 'cart', text: 'De la solicitud del cliente al pedido confirmado' },
  { icon: 'factory', text: 'Registro de producción, tiempos y mermas' },
  { icon: 'calculator', text: 'Costo estimado y costo real por orden' },
];

export default function LoginScreen() {
  const isWide = useIsWide();
  const insets = useSafeAreaInsets();
  const login = useSessionStore((s) => s.login);
  const logout = useSessionStore((s) => s.logout);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState<{ username?: string; password?: string }>({});
  // Account whose password was reset by the Administradora: asks for a new one (RF-03).
  const [mustChange, setMustChange] = useState<User | null>(null);

  useEffect(() => {
    if (isWide) return;
    AsyncStorage.getItem(REMEMBER_KEY)
      .then((saved) => saved && setUsername((u) => u || saved))
      .catch(() => undefined);
  }, [isWide]);

  const goHome = (user: User) => router.replace(homePath(user.role, isWide) as Href);

  const enter = (u: string, p: string) => {
    const result = login(u, p);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError('');
    if (!isWide) {
      (remember ? AsyncStorage.setItem(REMEMBER_KEY, result.user.username) : AsyncStorage.removeItem(REMEMBER_KEY)).catch(() => undefined);
    }
    if (result.user.mustChangePassword) {
      setMustChange(result.user);
      return;
    }
    goHome(result.user);
  };

  const submit = () => {
    const next = {
      username: username.trim() ? undefined : 'Ingrese su usuario.',
      password: password ? undefined : 'Ingrese su contraseña.',
    };
    setMissing(next);
    if (next.username || next.password) return;
    enter(username, password);
  };

  const quick = (isWide ? QUICK_ACCESS_WEB : QUICK_ACCESS_MOBILE) as readonly string[];
  const quickAccess = (
    <View style={styles.quick}>
      <Text style={styles.quickLabel}>Prototipo · entrar como:</Text>
      {quick.map((name) => (
        <Pressable
          key={name}
          testID={`quick-${name}`}
          accessibilityRole="button"
          onPress={() => {
            setUsername(name);
            setPassword(DEMO_PASSWORD);
            enter(name, DEMO_PASSWORD);
          }}
          style={(s) => [styles.chip, (s as { hovered?: boolean }).hovered && styles.chipHover]}
        >
          <Text style={styles.chipText}>{name}</Text>
        </Pressable>
      ))}
    </View>
  );

  const errorBanner = !!error && (
    <View style={[styles.errorBanner, !isWide && styles.errorBannerLarge]} accessibilityRole="alert" testID="login-error">
      <Icon name="alert" color={colors.alert} size={isWide ? 18 : 24} />
      <Text style={[styles.errorText, !isWide && styles.errorTextLarge]}>{LOGIN_ERROR}. Revise e intente de nuevo.</Text>
    </View>
  );

  const fields = mustChange ? (
    <NewPasswordForm
      user={mustChange}
      large={!isWide}
      onDone={() => goHome(mustChange)}
      onCancel={() => {
        logout();
        setMustChange(null);
        setPassword('');
      }}
    />
  ) : (
    <>
      {errorBanner}
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
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoComplete="current-password"
        error={missing.password ?? (error ? 'Distingue mayúsculas y minúsculas.' : undefined)}
        hint="Distingue mayúsculas y minúsculas."
        onSubmitEditing={submit}
        large={!isWide}
        testID="login-password"
      />
      {isWide ? (
        <View style={styles.showRow}>
          <LinkButton title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onPress={() => setShowPassword((v) => !v)} style={styles.showLink} />
        </View>
      ) : (
        <View style={styles.mobileOptions}>
          <Checkbox label="Recordar usuario en este celular" checked={remember} onChange={setRemember} large />
          <Checkbox label="Mostrar contraseña" checked={showPassword} onChange={setShowPassword} large />
        </View>
      )}
      <Button title="Ingresar" onPress={submit} fullWidth size={isWide ? 'md' : 'lg'} testID="login-submit" />
      <Text style={[styles.footnote, !isWide && styles.footnoteLarge]}>
        {isWide ? '¿Olvidó su contraseña? Pida a la Administradora que la restablezca.' : '¿Olvidó su contraseña? Avise a su supervisor.'}
      </Text>
    </>
  );

  if (isWide) {
    return (
      <View style={styles.wide}>
        <View style={styles.brand}>
          <View style={styles.brandInner}>
            <Logo inverted size={52} subtitle="SEGUPLAST S.A. · Guayaquil" />
            <Text style={styles.headline}>Pedidos, producción y costos de fundas plásticas en un solo lugar</Text>
            <View style={styles.benefits}>
              {BENEFITS.map((b) => (
                <View key={b.text} style={styles.benefit}>
                  <View style={styles.benefitIcon}>
                    <Icon name={b.icon} color={colors.gold} size={18} />
                  </View>
                  <Text style={styles.benefitText}>{b.text}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
        <ScrollView style={styles.formSide} contentContainerStyle={styles.formSideContent}>
          <View style={styles.card}>
            <View style={styles.cardTitles}>
              <Text style={styles.title}>{mustChange ? 'Cree una contraseña nueva' : 'Iniciar sesión'}</Text>
              <Text style={styles.subtitle}>
                {mustChange ? 'La Administradora restableció su contraseña.' : 'Use el usuario que le entregó la Administradora.'}
              </Text>
            </View>
            {fields}
          </View>
          {!mustChange && quickAccess}
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.mobile} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }} keyboardShouldPersistTaps="handled">
        <View style={[styles.mobileHeader, { paddingTop: insets.top + 48 }]}>
          <Mark size={52} />
          <Text style={styles.mobileTitle}>SeguCost</Text>
          <Text style={styles.mobileSubtitle}>Registro de producción en planta</Text>
        </View>
        <View style={styles.mobileBody}>
          {mustChange && <Text style={styles.mobileStepTitle}>Cree una contraseña nueva</Text>}
          {fields}
          {!mustChange && quickAccess}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** First login after a reset: new password twice (RF-03). */
function NewPasswordForm({ user, large, onDone, onCancel }: { user: User; large: boolean; onDone: () => void; onCancel: () => void }) {
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = () => {
    const result = changePassword(user.id, pwd, confirm);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    onDone();
  };
  return (
    <>
      <TextField label="Contraseña nueva" value={pwd} onChangeText={setPwd} secureTextEntry error={errors.password} hint="Al menos 6 caracteres." large={large} testID="new-password" />
      <TextField label="Repita la contraseña" value={confirm} onChangeText={setConfirm} secureTextEntry error={errors.confirm} large={large} onSubmitEditing={save} testID="new-password-confirm" />
      <Button title="Guardar y entrar" onPress={save} fullWidth size={large ? 'lg' : 'md'} />
      <Button title="Cancelar" variant="secondary" onPress={onCancel} fullWidth size={large ? 'lg' : 'md'} />
    </>
  );
}

const styles = StyleSheet.create({
  wide: { flex: 1, flexDirection: 'row', backgroundColor: colors.page },
  brand: { width: '41.7%', backgroundColor: colors.primary, justifyContent: 'center', paddingHorizontal: 72 },
  brandInner: { gap: 36, maxWidth: 460 },
  headline: { color: colors.onPrimary, fontSize: 32, lineHeight: 40, fontWeight: font.weight.bold, marginTop: 2 },
  benefits: { gap: 16, marginTop: 14 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitIcon: { width: 36, height: 36, borderRadius: 6, backgroundColor: colors.selected, alignItems: 'center', justifyContent: 'center' },
  benefitText: { color: '#D6DEE8', fontSize: 15 },
  formSide: { flex: 1 },
  formSideContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.xl },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 36,
    paddingVertical: 36,
    gap: 18,
    shadowColor: '#0B1F3A',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  cardTitles: { gap: 4, marginBottom: 2 },
  title: { fontSize: 26, fontWeight: font.weight.bold, color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted },
  showRow: { alignItems: 'flex-end', marginTop: -6 },
  showLink: { fontSize: 13, fontWeight: font.weight.medium },
  footnote: { fontSize: 13, color: colors.textMuted, lineHeight: 17 },
  footnoteLarge: { fontSize: 16, textAlign: 'center', lineHeight: 22 },
  quick: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  quickLabel: { fontSize: 12, color: colors.textMuted },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  chipHover: { borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: font.weight.semibold, color: colors.primary },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.alertBg, borderRadius: radius.md, padding: spacing.md },
  errorBannerLarge: { paddingHorizontal: 18, paddingVertical: 18, borderRadius: 12, gap: 18 },
  errorText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
  errorTextLarge: { fontSize: 16, lineHeight: 22 },
  mobile: { flex: 1, backgroundColor: colors.page },
  mobileHeader: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingBottom: 32, gap: 14 },
  mobileTitle: { color: colors.onPrimary, fontSize: 30, fontWeight: font.weight.bold, marginTop: 4 },
  mobileSubtitle: { color: '#C9D3E0', fontSize: 17 },
  mobileBody: { paddingHorizontal: 20, paddingTop: 24, gap: 20 },
  mobileStepTitle: { fontSize: 20, fontWeight: font.weight.bold, color: colors.text },
  mobileOptions: { gap: spacing.sm },
});
