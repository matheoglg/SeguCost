// Web sidebar filtered by role and grouped by process (RF-04, RI-01), as in the Figma design.
import { router, usePathname, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { showToast } from '@/components/Toast';
import type { Role } from '@/domain/types';
import { menuFor, menuGroups, menuPath, screenForPath, type ScreenDef } from '@/navigation/screens';
import { colors, font, layout, radius, spacing } from '@/theme';

/** react-native-web adds `hovered` to the Pressable state; the RN types do not declare it. */
const isHovered = (state: object) => (state as { hovered?: boolean }).hovered === true;

function Item({ icon, label, active, onPress, testID }: { icon: IconName; label: string; active?: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={(state) => [styles.item, isHovered(state) && !active && styles.itemHover, active && styles.itemActive]}
    >
      <Icon name={icon} size={18} color={active ? colors.gold : colors.onPrimary} />
      <Text style={[styles.itemText, active && styles.itemTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Sidebar({ role, onNavigate, onLogout }: { role: Role; onNavigate?: () => void; onLogout: () => void }) {
  const pathname = usePathname();
  const items = menuFor(role);
  const current = screenForPath(pathname);
  // Detail screens (W-13) light up their parent entry (W-12).
  const activeId = current?.parent ?? current?.id;

  const go = (s: ScreenDef) => {
    onNavigate?.();
    router.push(menuPath(s) as Href);
  };
  const home = items.find((i) => i.id === 'W-01');

  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <Logo inverted />
      </View>
      <ScrollView contentContainerStyle={styles.menu}>
        {home && <Item icon="home" label={home.title} active={activeId === home.id} onPress={() => go(home)} testID="menu-W-01" />}
        {menuGroups.map((group) => {
          const groupItems = items.filter((i) => i.group === group);
          if (!groupItems.length) return null;
          return (
            <View key={group} style={styles.group}>
              <Text style={styles.groupTitle}>{group}</Text>
              {groupItems.map((item) => (
                <Item
                  key={item.id}
                  icon={item.icon ?? 'file'}
                  label={item.menuLabel ?? item.title}
                  active={activeId === item.id}
                  onPress={() => go(item)}
                  testID={`menu-${item.id}`}
                />
              ))}
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.footer}>
        <Item icon="help" label="Ayuda" onPress={() => showToast('info', 'Ayuda: cada pantalla muestra junto al campo cómo corregir un error. Para dudas de acceso, consulte a la Administradora.', 6000)} />
        <Item icon="logout" label="Cerrar sesión" onPress={onLogout} testID="logout" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: layout.sidebarWidth, height: '100%', flexShrink: 0, backgroundColor: colors.primary },
  logo: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 14 },
  menu: { paddingHorizontal: 12, paddingBottom: spacing.lg, gap: 2 },
  group: { gap: 2, marginTop: spacing.md },
  groupTitle: {
    color: colors.sidebarMuted,
    fontSize: 11,
    fontWeight: font.weight.semibold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingHorizontal: 10,
    paddingBottom: 2,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 33,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
  },
  itemHover: { backgroundColor: 'rgba(255,255,255,0.08)' },
  itemActive: { backgroundColor: colors.selected },
  itemText: { flex: 1, color: colors.onPrimary, fontSize: 14, letterSpacing: -0.15 },
  itemTextActive: { fontWeight: font.weight.semibold },
  footer: { paddingHorizontal: 14, paddingVertical: spacing.lg, gap: 2 },
});
