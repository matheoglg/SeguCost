// Temporary content for screens not built yet: shows what the screen will cover.
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { screenById, type ScreenId } from '@/navigation/screens';
import { colors, font, radius, spacing } from '@/theme';

export function ScreenPlaceholder({ id }: { id: ScreenId }) {
  const screen = screenById[id];
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.id}>{screen.id}</Text>
      <Text style={styles.title}>{screen.title}</Text>
      <Text style={styles.purpose}>{screen.purpose}</Text>
      <View style={styles.tags}>
        {screen.rf.map((rf) => (
          <Text key={rf} style={styles.tag}>
            {rf}
          </Text>
        ))}
      </View>
      <Text style={styles.note}>Pantalla en construcción.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, gap: spacing.md, backgroundColor: colors.background, flexGrow: 1 },
  id: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: font.weight.bold },
  title: { color: colors.primary, fontSize: font.size.xxl, fontWeight: font.weight.bold },
  purpose: { color: colors.text, fontSize: font.size.md },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    backgroundColor: colors.surface,
    color: colors.primary,
    fontSize: font.size.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  note: { color: colors.textMuted, fontSize: font.size.md, marginTop: spacing.lg },
});
