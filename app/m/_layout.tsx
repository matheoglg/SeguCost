// Plant app stack (Android). One task per screen with a large header (RNF-02, RI-02).
import { Redirect, router, Stack, usePathname, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { roleLabels } from '@/domain/labels';
import { homePath, screenForPath } from '@/navigation/screens';
import { useIsWide } from '@/navigation/useIsWide';
import { useCurrentUser, useSessionStore } from '@/store/session';
import { colors, font, spacing } from '@/theme';

function LogoutButton() {
  const logout = useSessionStore((s) => s.logout);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Cerrar sesión"
      testID="logout"
      onPress={() => {
        logout();
        router.replace('/login');
      }}
      style={styles.headerButton}
    >
      <Icon name="logout" color={colors.onPrimary} size={24} />
    </Pressable>
  );
}

export default function MobileLayout() {
  const user = useCurrentUser();
  const pathname = usePathname();
  const isWide = useIsWide();

  if (!user) return <Redirect href="/login" />;

  const screen = screenForPath(pathname);
  if (screen && !screen.roles.includes(user.role)) {
    return (
      <View style={styles.denied}>
        <Text style={styles.deniedTitle}>Sin acceso a esta pantalla</Text>
        <Text style={styles.deniedText}>Su rol ({roleLabels[user.role]}) no usa {screen.title}.</Text>
        <Button title="Ir a mi inicio" size="lg" onPress={() => router.replace(homePath(user.role, isWide) as Href)} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.onPrimary,
        headerTitleStyle: { fontSize: font.size.xl, fontWeight: font.weight.bold },
        contentStyle: { backgroundColor: colors.surface },
      }}
    >
      <Stack.Screen name="ordenes/index" options={{ title: 'Mis órdenes', headerBackVisible: false, headerRight: LogoutButton }} />
      <Stack.Screen name="ordenes/[id]" options={{ title: 'Detalle de orden' }} />
      <Stack.Screen name="etapas/[id]" options={{ title: 'Detalle de etapa' }} />
      <Stack.Screen name="operacion" options={{ title: 'Operación en curso' }} />
      <Stack.Screen name="produccion" options={{ title: 'Registrar producción' }} />
      <Stack.Screen name="merma" options={{ title: 'Registrar merma' }} />
      <Stack.Screen name="cierre" options={{ title: 'Cierre en empacado' }} />
      <Stack.Screen name="turno" options={{ title: 'Resumen de turno' }} />
      <Stack.Screen name="planta" options={{ title: 'Planta', headerBackVisible: false, headerRight: LogoutButton }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  headerButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  denied: { flex: 1, padding: spacing.xl, gap: spacing.lg, justifyContent: 'center', backgroundColor: colors.background },
  deniedTitle: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.alert },
  deniedText: { fontSize: font.size.md, color: colors.text },
});
