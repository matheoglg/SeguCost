// Plant app building blocks: large text and touch targets (RNF-02, RI-02).
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { useUiStore } from '@/store/ui';
import { colors, font, radius, spacing } from '@/theme';

/** Scrollable content plus an optional footer pinned to the bottom for the main action. */
export function MobileScreen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <OfflineBanner />
      <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
      {footer && <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>{footer}</View>}
    </View>
  );
}

export function OfflineBanner() {
  const offline = useUiStore((s) => s.offline);
  const pending = useUiStore((s) => s.pendingSync);
  if (!offline) return null;
  return (
    <View style={styles.offline} accessibilityRole="alert">
      <Icon name="wifiOff" color={colors.warning} size={22} />
      <Text style={styles.offlineText}>
        Sin conexión: se sincronizará al volver la señal{pending ? ` (${pending} pendiente${pending === 1 ? '' : 's'})` : ''}
      </Text>
    </View>
  );
}

export function MCard({ children, onPress, style, accent, testID }: { children: ReactNode; onPress?: () => void; style?: ViewStyle; accent?: string; testID?: string }) {
  const content = <View style={[styles.card, accent ? { borderLeftWidth: 6, borderLeftColor: accent } : null, style]}>{children}</View>;
  if (!onPress) return content;
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && { opacity: 0.85 }}>
      {content}
    </Pressable>
  );
}

export function MTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function MText({ children, muted, bold, size = 'md' }: { children: ReactNode; muted?: boolean; bold?: boolean; size?: 'md' | 'lg' | 'xl' }) {
  return <Text style={[styles.text, { fontSize: font.size[size] }, muted && styles.muted, bold && styles.bold]}>{children}</Text>;
}

/** Label/value pair in a two-column grid. */
export function MInfo({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export function MInfoGrid({ children }: { children: ReactNode }) {
  return <View style={styles.infoGrid}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  footer: { padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  offline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.warningBg, padding: spacing.md },
  offlineText: { flex: 1, color: colors.warning, fontSize: font.size.md, fontWeight: font.weight.bold },
  card: { backgroundColor: colors.background, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.primary },
  text: { color: colors.text },
  muted: { color: colors.textMuted },
  bold: { fontWeight: font.weight.bold },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
  info: { width: '50%', paddingRight: spacing.sm, gap: 2 },
  infoLabel: { fontSize: font.size.md, color: colors.textMuted },
  infoValue: { fontSize: font.size.lg, color: colors.text, fontWeight: font.weight.bold },
});
