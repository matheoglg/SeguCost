import { StyleSheet, Text, View } from 'react-native';

import { orderStatusLabels } from '@/domain/labels';
import type { OrderStatus } from '@/domain/types';
import { colors, font, radius, spacing } from '@/theme';

export type Tone = 'neutral' | 'info' | 'success' | 'alert' | 'warning' | 'rest';

const TONES: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: colors.idleBg, fg: colors.idle },
  info: { bg: colors.restBg, fg: colors.primary },
  success: { bg: colors.successBg, fg: colors.success },
  alert: { bg: colors.alertBg, fg: colors.alert },
  warning: { bg: colors.warningBg, fg: colors.warning },
  rest: { bg: colors.restBg, fg: colors.rest },
};

export function StatusBadge({ label, tone = 'neutral', large }: { label: string; tone?: Tone; large?: boolean }) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }, large && styles.large]}>
      <View style={[styles.dot, { backgroundColor: t.fg }]} />
      <Text style={[styles.text, { color: t.fg }, large && styles.largeText]}>{label}</Text>
    </View>
  );
}

export const orderStatusTone: Record<OrderStatus, Tone> = {
  pending: 'neutral',
  inProgress: 'info',
  toValidate: 'warning',
  closed: 'success',
  cancelled: 'alert',
};

export function OrderStatusBadge({ status, large }: { status: OrderStatus; large?: boolean }) {
  return <StatusBadge label={orderStatusLabels[status]} tone={orderStatusTone[status]} large={large} />;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.lg,
  },
  large: { paddingHorizontal: spacing.md, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 13, fontWeight: font.weight.bold },
  largeText: { fontSize: font.size.md },
});
