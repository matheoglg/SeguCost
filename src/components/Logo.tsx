// SEGUPLAST mark for the prototype: a plastic bag glyph plus the company and system names.
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { colors, font } from '@/theme';

export function BagMark({ size = 40, inverted = false }: { size?: number; inverted?: boolean }) {
  const bg = inverted ? colors.onPrimary : colors.primary;
  const fg = inverted ? colors.primary : colors.onPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Rect width={40} height={40} rx={9} fill={bg} />
      <Path d="M11 14h18l-2 18H13L11 14z" fill="none" stroke={fg} strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M15.5 14v-2a4.5 4.5 0 0 1 9 0v2" fill="none" stroke={fg} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

/** Company and system name; `inverted` for dark backgrounds. */
export function Logo({ inverted = false, size = 40 }: { inverted?: boolean; size?: number }) {
  const text = inverted ? colors.onPrimary : colors.primary;
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="SEGUPLAST SeguCost">
      <BagMark size={size} inverted={inverted} />
      <View>
        <Text style={[styles.company, { color: text }]}>SEGUPLAST S.A.</Text>
        <Text style={[styles.system, { color: text, fontSize: size * 0.5 }]}>SeguCost</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  company: { fontSize: 12, fontWeight: font.weight.bold, letterSpacing: 1.2 },
  system: { fontWeight: font.weight.bold, lineHeight: 24 },
});
