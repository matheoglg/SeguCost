// Large numeric keypad for gloved hands in the plant (M-04, M-05, M-06). Decimal comma.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { colors, font, radius, spacing } from '@/theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'del'] as const;

export function NumberPad({ value, onChange, decimals = true, maxLength = 9 }: { value: string; onChange: (v: string) => void; decimals?: boolean; maxLength?: number }) {
  const press = (key: (typeof KEYS)[number]) => {
    if (key === 'del') return onChange(value.slice(0, -1));
    if (key === ',') {
      if (!decimals || value.includes(',')) return;
      return onChange(value === '' ? '0,' : `${value},`);
    }
    if (value.length >= maxLength) return;
    if (value === '0') return onChange(key);
    const [, dec] = value.split(',');
    if (dec !== undefined && dec.length >= 2) return;
    onChange(value + key);
  };
  return (
    <View style={styles.pad}>
      {KEYS.map((key) => {
        const disabled = key === ',' && !decimals;
        return (
          <Pressable
            key={key}
            testID={`key-${key}`}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={key === 'del' ? 'Borrar' : key === ',' ? 'Coma decimal' : key}
            onPress={() => press(key)}
            style={({ pressed }) => [styles.key, pressed && styles.pressed, disabled && styles.disabled]}
          >
            {key === 'del' ? <Icon name="chevronLeft" color={colors.primary} size={30} /> : <Text style={styles.keyText}>{disabled ? '' : key}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

/** "24950,5" -> "24.950,5" while typing. */
const grouped = (v: string) => {
  const [int, dec] = v.split(',');
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (dec !== undefined ? `,${dec}` : '');
};

/** Field that shows the typed value; tap to make it the keypad target. */
export function PadField({ label, value, unit, active, onPress, error, testID }: { label: string; value: string; unit: string; active: boolean; onPress: () => void; error?: string; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value || 'vacío'} ${unit}`} style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.field, active && styles.fieldActive, !!error && styles.fieldError]}>
        <Text style={[styles.fieldValue, !value && styles.placeholder]}>{value ? grouped(value) : '0'}</Text>
        <Text style={styles.fieldUnit}>{unit}</Text>
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
  key: { width: '31.5%', height: 64, borderRadius: radius.md, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.restBg },
  disabled: { backgroundColor: colors.surface, borderColor: colors.surface },
  keyText: { fontSize: 28, fontWeight: font.weight.bold, color: colors.primary },
  fieldWrap: { gap: spacing.xs, flex: 1 },
  fieldLabel: { fontSize: font.size.md, fontWeight: font.weight.bold, color: colors.text },
  field: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  fieldActive: { borderColor: colors.primary, borderWidth: 3 },
  fieldError: { borderColor: colors.alert },
  fieldValue: { fontSize: 32, fontWeight: font.weight.bold, color: colors.text, fontVariant: ['tabular-nums'] },
  placeholder: { color: colors.border },
  fieldUnit: { fontSize: font.size.lg, color: colors.textMuted },
  error: { fontSize: font.size.md, color: colors.alert },
});
