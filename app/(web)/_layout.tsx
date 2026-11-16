// Office shell: sidebar filtered by role and 64 px header with breadcrumb, notifications and user (RI-01, RF-04).
// From 1024 px the sidebar is fixed; on narrower screens it opens as a panel.
import { Redirect, router, Slot, usePathname, type Href } from 'expo-router';
import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Sidebar } from '@/components/web/Sidebar';
import { roleLabels } from '@/domain/labels';
import { breadcrumbFor, homePath, screenForPath } from '@/navigation/screens';
import { useIsWide } from '@/navigation/useIsWide';
import { useDataStore } from '@/store/data';
import { attentionItems } from '@/store/selectors';
import { useCurrentUser, useSessionStore } from '@/store/session';
import { colors, font, layout, radius, spacing } from '@/theme';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

export default function WebLayout() {
  const user = useCurrentUser();
  const logout = useSessionStore((s) => s.logout);
  const db = useDataStore((s) => s.db);
  const isWide = useIsWide();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  if (!user) return <Redirect href="/login" />;

  const screen = screenForPath(pathname);
  const allowed = !screen || screen.roles.includes(user.role);
  const crumbs = breadcrumbFor(pathname);
  const pending = attentionItems(db, user.role).length;

  const signOut = () => {
    setUserMenu(false);
    logout();
    router.replace('/login');
  };

  return (
    <View style={styles.root}>
      {isWide && <Sidebar role={user.role} onLogout={signOut} />}
      <View style={styles.main}>
        <View style={[styles.header, !isWide && { paddingTop: insets.top, height: layout.headerHeight + insets.top }]}>
          {!isWide && (
            <Pressable accessibilityRole="button" accessibilityLabel="Abrir menú" onPress={() => setMenuOpen(true)} style={styles.iconButton}>
              <Icon name="menu" color={colors.primary} size={24} />
            </Pressable>
          )}
          <View style={styles.crumbs} accessibilityRole="header">
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <Fragment key={`${c.label}-${i}`}>
                  {i > 0 && <Icon name="chevronRight" size={14} color={colors.textMuted} />}
                  {c.path && !last ? (
                    <Pressable onPress={() => router.push(c.path as Href)} accessibilityRole="link">
                      <Text style={styles.crumb}>{c.label}</Text>
                    </Pressable>
                  ) : (
                    <Text style={[styles.crumb, last && styles.crumbLast]} numberOfLines={1}>
                      {c.label}
                    </Text>
                  )}
                </Fragment>
              );
            })}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={pending ? `${pending} pendientes` : 'Sin pendientes'}
            onPress={() => router.push('/panel')}
            style={styles.iconButton}
            testID="bell"
          >
            <Icon name="bell" color={colors.primary} size={20} />
            {pending > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pending}</Text>
              </View>
            )}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Menú de usuario" onPress={() => setUserMenu((v) => !v)} style={styles.userChip} testID="user-menu">
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(user.name)}</Text>
            </View>
            {isWide && (
              <View>
                <Text style={styles.userName} numberOfLines={1}>
                  {user.name}
                </Text>
                <Text style={styles.userRole} numberOfLines={1}>
                  {roleLabels[user.role]}
                </Text>
              </View>
            )}
            <Icon name="chevronDown" color={colors.textMuted} size={16} />
          </Pressable>
          {userMenu && (
            <View style={styles.dropdown}>
              <Pressable onPress={signOut} style={styles.dropdownItem} accessibilityRole="button">
                <Icon name="logout" color={colors.primary} size={18} />
                <Text style={styles.dropdownText}>Cerrar sesión</Text>
              </Pressable>
            </View>
          )}
        </View>
        <View style={styles.content}>
          {allowed ? (
            <Slot />
          ) : (
            <View style={styles.denied}>
              <Text style={styles.deniedTitle}>Acceso denegado</Text>
              <Text style={styles.deniedText}>
                Su rol ({roleLabels[user.role]}) no tiene permiso para {screen!.title}.
              </Text>
              <Button title="Ir a mi inicio" onPress={() => router.replace(homePath(user.role, isWide) as Href)} />
            </View>
          )}
        </View>
      </View>

      {!isWide && menuOpen && (
        <View style={StyleSheet.absoluteFill}>
          <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)} accessibilityLabel="Cerrar menú" />
          <View style={[styles.drawer, { paddingTop: insets.top }]}>
            <Sidebar role={user.role} onNavigate={() => setMenuOpen(false)} onLogout={signOut} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: colors.page },
  main: { flex: 1 },
  header: {
    height: layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: 40,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 10,
  },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  crumbs: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  crumb: { fontSize: 14, color: colors.textMuted },
  crumbLast: { color: colors.text, fontWeight: font.weight.semibold },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.alert,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.onPrimary, fontSize: 11, fontWeight: font.weight.bold },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 4,
    paddingRight: 12,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.selected, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.onPrimary, fontSize: 12, fontWeight: font.weight.bold },
  userName: { fontSize: 13, fontWeight: font.weight.semibold, color: colors.text },
  userRole: { fontSize: 11, color: colors.textMuted },
  dropdown: {
    position: 'absolute',
    top: 56,
    right: 40,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    minWidth: 200,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, height: 44 },
  dropdownText: { fontSize: 14, color: colors.text },
  content: { flex: 1 },
  denied: { padding: 40, gap: spacing.md, alignItems: 'flex-start' },
  deniedTitle: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.alert },
  deniedText: { fontSize: font.size.md, color: colors.text },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  drawer: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: colors.primary },
});
