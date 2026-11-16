// Indicator card of the Figma design: icon + label, large value and a colored detail line.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { colors, font } from '@/theme';

export type KpiTone = 'neutral' | 'warning' | 'success' | 'alert' | 'info';

const DETAIL: Record<KpiTone, string> = {
  neutral: colors.textMuted,
  warning: colors.warning,
  success: colors.success,
  alert: colors.alert,
  info: colors.info,
};

export function Kpi({
  icon,
  label,
  value,
  detail,
  tone = 'neutral',
  valueTone,
  unit,
  onPress,
  testID,
}: {
  icon?: IconName;
  label: string;
  value: string;
  detail?: string;
  tone?: KpiTone;
  /** Color of the value itself (W-16 «Recuperado» in green). */
  valueTone?: KpiTone;
  /** Small text under the value ("USD"). */
  unit?: string;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label}: ${value}${detail ? `, ${detail}` : ''}`}
      style={(s) => [styles.card, (s as { hovered?: boolean }).hovered && styles.hover]}
    >
      <View style={styles.labelRow}>
        {icon && <Icon name={icon} size={16} color={colors.textMuted} />}
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={[styles.value, valueTone && valueTone !== 'neutral' && { color: DETAIL[valueTone] }]}>{value}</Text>
      {unit && <Text style={styles.unit}>{unit}</Text>}
      {detail && <Text style={[styles.detail, { color: DETAIL[tone] }]}>{detail}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 200,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 6,
  },
  hover: { borderColor: '#B9C4D3' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 14, color: colors.textMuted },
  value: { fontSize: 28, fontWeight: font.weight.bold, color: colors.text, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 13, color: colors.textMuted, marginTop: -2 },
  detail: { fontSize: 13, fontWeight: font.weight.medium },
});
