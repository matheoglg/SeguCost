// Web sidebar filtered by role (RF-03, RI-01).
import { router, usePathname, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Logo } from '@/components/Logo';
import type { Role } from '@/domain/types';
import { menuFor, menuGroups, type ScreenId } from '@/navigation/screens';
import { useDataStore } from '@/store/data';
import { colors, font, radius, spacing } from '@/theme';

/** react-native-web adds `hovered` to the Pressable state; the RN types do not declare it. */
const isHovered = (state: object) => (state as { hovered?: boolean }).hovered === true;

/** Pending items shown as a badge next to the menu entry. */
function usePendingCounts(): Partial<Record<ScreenId, number>> {
  const db = useDataStore((s) => s.db);
  return {
    'W-06': db.recipes.filter((r) => r.status === 'draft').length,
    'W-17': db.priceProposals.filter((p) => p.status === 'proposed').length,
  };
}

export function Sidebar({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = menuFor(role);
  const counts = usePendingCounts();

  const go = (path: string) => {
    onNavigate?.();
    router.push(path as Href);
  };

  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <Logo inverted size={36} />
      </View>
      <ScrollView contentContainerStyle={styles.menu}>
        {menuGroups.map((group) => {
          const groupItems = items.filter((i) => i.menu === group);
          if (!groupItems.length) return null;
          return (
            <View key={group} style={styles.group}>
              <Text style={styles.groupTitle}>{group}</Text>
              {groupItems.map((item) => {
                const active = pathname === item.path;
                const count = counts[item.id];
                return (
                  <Pressable
                    key={item.id}
                    testID={`menu-${item.id}`}
                    accessibilityRole="link"
                    accessibilityState={{ selected: active }}
                    onPress={() => go(item.path)}
                    style={(state) => [styles.item, (isHovered(state) || state.pressed) && styles.itemHover, active && styles.itemActive]}
                  >
                    <Text style={[styles.itemText, active && styles.itemTextActive]} numberOfLines={1}>
                      {item.menuLabel ?? item.title}
                    </Text>
                    {!!count && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{count}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          );
        })}
        {role === 'sup' && (
          <View style={styles.group}>
            <Text style={styles.groupTitle}>Planta</Text>
            <Pressable onPress={() => go('/m/planta')} style={(state) => [styles.item, isHovered(state) && styles.itemHover]} accessibilityRole="link">
              <Text style={styles.itemText}>Abrir app móvil de planta</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary },
  logo: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  menu: { paddingHorizontal: spacing.sm, paddingBottom: spacing.xl, gap: spacing.md },
  group: { gap: 2 },
  groupTitle: {
    color: '#A9B8CC',
    fontSize: 12,
    fontWeight: font.weight.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  itemHover: { backgroundColor: 'rgba(255,255,255,0.08)' },
  itemActive: { backgroundColor: colors.onPrimary },
  itemText: { flex: 1, color: colors.onPrimary, fontSize: font.size.sm + 1 },
  itemTextActive: { color: colors.primary, fontWeight: font.weight.bold },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#F2B705', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: colors.primary, fontSize: 12, fontWeight: font.weight.bold },
});
