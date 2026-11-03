// Stage route shown as numbered steps (RF-06, RF-11).
import { StyleSheet, Text, View } from 'react-native';

import { stageLabels } from '@/domain/labels';
import { buildRoute } from '@/domain/routing';
import type { ProductType } from '@/domain/types';
import { colors, font, radius, spacing } from '@/theme';

export function RoutePreview({ type }: { type: ProductType }) {
  const route = buildRoute(type);
  return (
    <View style={styles.row} testID="route-preview">
      {route.map((s, i) => {
        const extra = (s === 'printing' && type === 'printed') || (s === 'dieCutting' && type === 'nursery');
        return (
          <View key={s} style={styles.item}>
            <View style={[styles.step, extra && styles.extra]}>
              <Text style={[styles.text, extra && styles.extraText]}>
                {i + 1}. {stageLabels[s]}
              </Text>
            </View>
            {i < route.length - 1 && <Text style={styles.arrow}>→</Text>}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center' },
  step: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.lg, backgroundColor: colors.surface },
  extra: { backgroundColor: colors.primary },
  text: { fontSize: font.size.sm, color: colors.text, fontWeight: font.weight.medium },
  extraText: { color: colors.onPrimary, fontWeight: font.weight.bold },
  arrow: { marginHorizontal: spacing.xs, color: colors.textMuted, fontSize: font.size.md },
});
