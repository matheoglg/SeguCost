import { StyleSheet, Text, View } from 'react-native';

import { orderStatusLabels } from '@/domain/labels';
import type { OrderStatus } from '@/domain/types';
import { colors, font, radius, spacing } from '@/theme';

export type Tone = 'neutral' | 'info' | 'success' | 'alert' | 'warning' | 'rest' | 'dark';

// Pills with color and text together (RNF-19), as in the captures.
const TONES: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: colors.idleBg, fg: colors.idle },
  info: { bg: colors.infoBg, fg: colors.info },
  dark: { bg: colors.primary, fg: colors.onPrimary },
  success: { bg: colors.successBg, fg: colors.success },
  alert: { bg: colors.alertBg, fg: colors.alert },
  warning: { bg: colors.warningBg, fg: colors.warning },
  rest: { bg: colors.restBg, fg: colors.rest },
};

export function StatusBadge({ label, tone = 'neutral', large }: { label: string; tone?: Tone; large?: boolean }) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }, large && styles.large]}>
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
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  large: { paddingHorizontal: spacing.lg, paddingVertical: 6 },
  text: { fontSize: 12, fontWeight: font.weight.semibold },
  largeText: { fontSize: 20, fontWeight: font.weight.medium },
});
