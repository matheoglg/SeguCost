import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, spacing } from '@/theme';
import type { Tone } from '../StatusBadge';

const ACCENT: Record<Tone, string> = {
  neutral: colors.primary,
  info: colors.primary,
  success: colors.success,
  alert: colors.alert,
  warning: colors.warning,
  rest: colors.rest,
};

export function KpiCard({ label, value, detail, tone = 'neutral', onPress, testID }: { label: string; value: string; detail?: string; tone?: Tone; onPress?: () => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={(s) => [styles.card, { borderTopColor: ACCENT[tone] }, (s as { hovered?: boolean }).hovered && styles.hover]}
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: tone === 'alert' ? colors.alert : colors.text }]}>{value}</Text>
      {detail && (
        <View style={styles.detailRow}>
          <Text style={styles.detail}>{detail}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 220,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 4,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  hover: { borderColor: colors.primaryLight },
  label: { fontSize: font.size.sm, color: colors.textMuted, fontWeight: font.weight.bold },
  value: { fontSize: 30, fontWeight: font.weight.bold, fontVariant: ['tabular-nums'] },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  detail: { fontSize: font.size.sm, color: colors.textMuted },
});
