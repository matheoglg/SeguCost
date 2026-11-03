// Office shell: sidebar filtered by role and header with user and role (RI-01, RF-03).
// From 1024 px the sidebar is fixed; on narrower screens (office roles on Android) it opens as a panel.
import { Redirect, router, Slot, usePathname, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Sidebar } from '@/components/web/Sidebar';
import { roleLabels } from '@/domain/labels';
import { homePath, screenForPath } from '@/navigation/screens';
import { useIsWide } from '@/navigation/useIsWide';
import { useCurrentUser, useSessionStore } from '@/store/session';
import { colors, font, layout, spacing } from '@/theme';

export default function WebLayout() {
  const user = useCurrentUser();
  const logout = useSessionStore((s) => s.logout);
  const isWide = useIsWide();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return <Redirect href="/login" />;

  const screen = screenForPath(pathname);
  const allowed = !screen || screen.roles.includes(user.role);

  const signOut = () => {
    logout();
    router.replace('/login');
  };

  return (
    <View style={styles.root}>
      {isWide && (
        <View style={styles.sidebar}>
          <Sidebar role={user.role} />
        </View>
      )}
      <View style={styles.main}>
        <View style={[styles.header, { paddingTop: isWide ? spacing.md : insets.top + spacing.sm }]}>
          {!isWide && (
            <Pressable accessibilityRole="button" accessibilityLabel="Abrir menú" onPress={() => setMenuOpen(true)} style={styles.menuButton}>
              <Icon name="menu" color={colors.primary} size={26} />
            </Pressable>
          )}
          <View style={styles.titleBlock}>
            {screen && isWide && <Text style={styles.screenId}>{screen.id}</Text>}
            <Text style={styles.title} numberOfLines={1}>
              {screen?.title ?? 'SeguCost'}
            </Text>
          </View>
          <View style={styles.user}>
            <View style={styles.userText}>
              <Text style={styles.userName} numberOfLines={1}>
                {user.name}
              </Text>
              <Text style={styles.userRole} numberOfLines={1}>
                {roleLabels[user.role]}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar sesión" onPress={signOut} style={styles.logout} testID="logout">
              <Icon name="logout" color={colors.primary} />
              {isWide && <Text style={styles.logoutText}>Salir</Text>}
            </Pressable>
          </View>
        </View>
        <View style={styles.content}>
          {allowed ? (
            <Slot />
          ) : (
            <View style={styles.denied}>
              <Text style={styles.deniedTitle}>Sin acceso a esta pantalla</Text>
              <Text style={styles.deniedText}>Su rol ({roleLabels[user.role]}) no tiene permiso para {screen!.title}.</Text>
              <Button title="Ir a mi inicio" onPress={() => router.replace(homePath(user.role, isWide) as Href)} />
            </View>
          )}
        </View>
      </View>

      {!isWide && menuOpen && (
        <View style={StyleSheet.absoluteFill}>
          <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)} accessibilityLabel="Cerrar menú" />
          <View style={[styles.drawer, { paddingTop: insets.top }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar menú" onPress={() => setMenuOpen(false)} style={styles.drawerClose}>
              <Icon name="close" color={colors.onPrimary} size={26} />
            </Pressable>
            <Sidebar role={user.role} onNavigate={() => setMenuOpen(false)} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: colors.surface },
  sidebar: { width: layout.sidebarWidth },
  main: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.md },
  titleBlock: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  screenId: { fontSize: font.size.sm, color: colors.textMuted, fontWeight: font.weight.bold },
  title: { flexShrink: 1, fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.primary },
  user: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexShrink: 1 },
  userText: { alignItems: 'flex-end', flexShrink: 1 },
  userName: { fontSize: font.size.md, fontWeight: font.weight.bold, color: colors.text },
  userRole: { fontSize: font.size.sm, color: colors.textMuted },
  logout: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44, minWidth: 44, justifyContent: 'center' },
  logoutText: { color: colors.primary, fontSize: font.size.md, fontWeight: font.weight.bold },
  content: { flex: 1 },
  denied: { padding: spacing.xxl, gap: spacing.md, alignItems: 'flex-start' },
  deniedTitle: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.alert },
  deniedText: { fontSize: font.size.md, color: colors.text },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  drawer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 300, backgroundColor: colors.primary },
  drawerClose: { alignSelf: 'flex-end', width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
});
