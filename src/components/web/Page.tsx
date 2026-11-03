// Building blocks for web screens: scrollable page, cards, section titles and toolbars.
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, font, radius, spacing } from '@/theme';

export function Page({ children, intro }: { children: ReactNode; intro?: string }) {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      {intro && <Text style={styles.intro}>{intro}</Text>}
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
  children: ReactNode;
  style?: ViewStyle;
  padded?: boolean;
}) {
  return (
    <View style={[styles.card, !padded && styles.cardFlush, style]}>
      {(title || actions) && (
        <View style={[styles.cardHeader, !padded && styles.cardHeaderFlush]}>
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
export function Row({ children, gap = spacing.lg, style, align = 'flex-start' }: { children: ReactNode; gap?: number; style?: ViewStyle; align?: ViewStyle['alignItems'] }) {
  return <View style={[styles.row, { gap, alignItems: align }, style]}>{children}</View>;
}

/** Flexible column inside a Row; minWidth keeps it readable before wrapping. */
export function Col({ children, flex = 1, minWidth = 280 }: { children: ReactNode; flex?: number; minWidth?: number }) {
  return <View style={{ flex, minWidth, flexBasis: minWidth, gap: spacing.lg }}>{children}</View>;
}

export function Note({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'alert' | 'success' | 'warning' }) {
  const palette = {
    info: { bg: colors.restBg, fg: colors.primary },
    alert: { bg: colors.alertBg, fg: colors.alert },
    success: { bg: colors.successBg, fg: colors.success },
    warning: { bg: colors.warningBg, fg: colors.warning },
  }[tone];
  return (
    <View style={[styles.note, { backgroundColor: palette.bg }]}>
      <Text style={[styles.noteText, { color: palette.fg }]}>{children}</Text>
    </View>
  );
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number' ? <Text style={styles.fieldValue}>{value}</Text> : value}
    </View>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.xl, gap: spacing.lg, paddingBottom: 48 },
  intro: { fontSize: font.size.md, color: colors.textMuted, maxWidth: 900 },
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardFlush: { padding: 0, gap: 0, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  cardHeaderFlush: { padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  cardTitles: { flex: 1, gap: 2, minWidth: 200 },
  cardTitle: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.text },
  cardSubtitle: { fontSize: font.size.sm, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', alignItems: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  note: { borderRadius: radius.sm, padding: spacing.md },
  noteText: { fontSize: font.size.sm + 1, lineHeight: 21 },
  field: { gap: 2, minWidth: 140 },
  fieldLabel: { fontSize: 12, color: colors.textMuted, fontWeight: font.weight.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldValue: { fontSize: font.size.md, color: colors.text },
  empty: { fontSize: font.size.md, color: colors.textMuted, padding: spacing.lg, textAlign: 'center' },
});
