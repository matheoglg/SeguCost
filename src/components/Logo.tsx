// SeguCost mark from the Figma design: gold rounded square with an "S", plus system and company names.
import { StyleSheet, Text, View } from 'react-native';

import { colors, font } from '@/theme';

/** Gold square with the "S" initial. */
export function Mark({ size = 34 }: { size?: number }) {
  return (
    <View style={[styles.mark, { width: size, height: size, borderRadius: size * 0.22 }]}>
      <Text style={[styles.markText, { fontSize: size * 0.56 }]}>S</Text>
    </View>
  );
}

/**
 * System name with the company below; `inverted` for dark backgrounds.
 * `size` is the mark size; the text scales with it.
 */
export function Logo({ inverted = false, size = 34, subtitle = 'SEGUPLAST S.A.' }: { inverted?: boolean; size?: number; subtitle?: string }) {
  const text = inverted ? colors.onPrimary : colors.primary;
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel={`SeguCost, ${subtitle}`}>
      <Mark size={size} />
      <View>
        <Text style={[styles.system, { color: text, fontSize: size * 0.53 }]}>SeguCost</Text>
        <Text style={[styles.company, { color: inverted ? '#C9D3E0' : colors.textMuted, fontSize: Math.max(11, size * 0.32) }]}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  markText: { color: colors.primary, fontWeight: font.weight.bold },
  system: { fontWeight: font.weight.bold },
  company: { letterSpacing: 0.2 },
});
