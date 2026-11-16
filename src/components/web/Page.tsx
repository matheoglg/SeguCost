// Building blocks for web screens, following the Figma design: page with title, subtitle and one main
// action; white cards with 24 px padding; notices with icon; rows and columns that wrap.
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { colors, font, radius, spacing } from '@/theme';

export function Page({
  children,
  title,
  subtitle,
  actions,
  intro,
  testID,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Short explanation for screens without a title header (previous version screens). */
  intro?: string;
  testID?: string;
}) {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} testID={testID}>
      {intro && !title && <Text style={styles.subtitle}>{intro}</Text>}
      {title && (
        <View style={styles.header}>
          <View style={styles.titles}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
          {actions && <View style={styles.actions}>{actions}</View>}
        </View>
      )}
      {children}
    </ScrollView>
  );
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  style,
  padded = true,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children?: ReactNode;
  style?: ViewStyle;
  padded?: boolean;
}) {
  return (
    <View style={[styles.card, !padded && styles.cardFlush, style]}>
      {(title || actions) && (
        <View style={styles.cardHeader}>
          <View style={styles.cardTitles}>
            {title && <Text style={styles.cardTitle}>{title}</Text>}
            {subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
          </View>
          {actions && <View style={styles.actions}>{actions}</View>}
        </View>
      )}
      {children}
    </View>
  );
}

/** Horizontal group that wraps on narrow screens. */
export function Row({ children, gap = spacing.xl, style, align = 'flex-start' }: { children: ReactNode; gap?: number; style?: ViewStyle; align?: ViewStyle['alignItems'] }) {
  return <View style={[styles.row, { gap, alignItems: align }, style]}>{children}</View>;
}

/** Flexible column inside a Row; minWidth keeps it readable before wrapping. */
export function Col({ children, flex = 1, minWidth = 280, gap = spacing.xl }: { children: ReactNode; flex?: number; minWidth?: number; gap?: number }) {
  return <View style={{ flex, minWidth, flexBasis: minWidth, gap }}>{children}</View>;
}

export type NoteTone = 'info' | 'alert' | 'success' | 'warning';

const NOTE: Record<NoteTone, { bg: string; fg: string; icon: IconName; text: string }> = {
  info: { bg: colors.infoBg, fg: colors.info, icon: 'info', text: colors.text },
  alert: { bg: colors.alertBg, fg: colors.alert, icon: 'alert', text: colors.text },
  success: { bg: colors.successBg, fg: colors.success, icon: 'check', text: colors.text },
  warning: { bg: colors.warningBg, fg: colors.warning, icon: 'alert', text: colors.text },
};

/** Notice with icon and text; color and text together (RNF-19). */
export function Note({ children, tone = 'info', action, style }: { children: ReactNode; tone?: NoteTone; action?: ReactNode; style?: ViewStyle }) {
  const t = NOTE[tone];
  return (
    <View style={[styles.note, { backgroundColor: t.bg }, style]} accessibilityRole="alert">
      <Icon name={t.icon} color={t.fg} size={18} />
      <Text style={[styles.noteText, { color: t.text }]}>{children}</Text>
      {action}
    </View>
  );
}

/** Label above a value, as in the record headers of the captures. */
export function Field({ label, value, valueStyle }: { label: string; value: ReactNode; valueStyle?: object }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number' ? <Text style={[styles.fieldValue, valueStyle]}>{value}</Text> : value}
    </View>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

export const pageStyles = StyleSheet.create({
  muted: { fontSize: 14, color: colors.textMuted },
  body: { fontSize: 15, color: colors.text, lineHeight: 22 },
  sectionTitle: { fontSize: 17, fontWeight: font.weight.semibold, color: colors.text },
});

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { paddingHorizontal: 40, paddingTop: 28, paddingBottom: 48, gap: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg, flexWrap: 'wrap' },
  titles: { flex: 1, minWidth: 320, gap: 6 },
  title: { fontSize: 28, fontWeight: font.weight.bold, color: colors.text, letterSpacing: -0.3 },
  subtitle: { fontSize: 15, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap', alignItems: 'center' },
  card: {
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  cardFlush: { padding: 0, gap: 0, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  cardTitles: { flex: 1, gap: 2, minWidth: 200 },
  cardTitle: { fontSize: 17, fontWeight: font.weight.semibold, color: colors.text },
  cardSubtitle: { fontSize: 13, color: colors.textMuted },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  note: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  noteText: { flex: 1, fontSize: 14, lineHeight: 20 },
  field: { gap: 4, minWidth: 120 },
  fieldLabel: { fontSize: 13, color: colors.textMuted },
  fieldValue: { fontSize: 16, color: colors.text, fontWeight: font.weight.semibold },
  empty: { fontSize: 15, color: colors.textMuted, padding: spacing.lg, textAlign: 'center' },
});
