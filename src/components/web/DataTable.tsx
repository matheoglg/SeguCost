// Simple data table for the web screens. Scrolls horizontally when the window is narrow.
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, font, spacing } from '@/theme';

export interface Column<T> {
  key: string;
  title: string;
  /** Relative width; columns share the table width proportionally. */
  flex?: number;
  minWidth?: number;
  align?: 'left' | 'right' | 'center';
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowPress?: (row: T) => void;
  selectedKey?: string;
  emptyText?: string;
  highlight?: (row: T) => 'alert' | 'success' | undefined;
  testID?: string;
}

export function DataTable<T>({ columns, rows, rowKey, onRowPress, selectedKey, emptyText = 'Sin registros.', highlight, testID }: DataTableProps<T>) {
  const minWidth = columns.reduce((t, c) => t + (c.minWidth ?? 120), 0);
  // Explicit width: inside a horizontal ScrollView long texts would otherwise widen the row
  // and push the last columns out of view.
  const [available, setAvailable] = useState(0);
  const cell = (c: Column<T>) => ({
    flexGrow: c.flex ?? 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: c.minWidth ?? 120,
    alignItems: (c.align === 'right' ? 'flex-end' : c.align === 'center' ? 'center' : 'flex-start') as 'flex-end' | 'center' | 'flex-start',
  });

  return (
    <ScrollView horizontal contentContainerStyle={styles.scroll} testID={testID} onLayout={(e) => setAvailable(e.nativeEvent.layout.width)}>
      <View style={[styles.table, { width: Math.max(minWidth, available) }]}>
        <View style={[styles.row, styles.headerRow]}>
          {columns.map((c) => (
            <View key={c.key} style={[styles.cell, cell(c)]}>
              <Text style={[styles.headerText, c.align === 'right' && styles.right]}>{c.title}</Text>
            </View>
          ))}
        </View>
        {rows.length === 0 && <Text style={styles.empty}>{emptyText}</Text>}
        {rows.map((row) => {
          const key = rowKey(row);
          const mark = highlight?.(row);
          const content = columns.map((c) => {
            const value = c.render(row);
            return (
              <View key={c.key} style={[styles.cell, cell(c)]}>
                {typeof value === 'string' || typeof value === 'number' ? (
                  <Text style={[styles.cellText, c.align === 'right' && styles.right]}>{value}</Text>
                ) : (
                  value
                )}
              </View>
            );
          });
          const rowStyle = [
            styles.row,
            styles.bodyRow,
            mark === 'alert' && styles.rowAlert,
            mark === 'success' && styles.rowSuccess,
            selectedKey === key && styles.rowSelected,
          ];
          return onRowPress ? (
            <Pressable key={key} onPress={() => onRowPress(row)} style={(s) => [...rowStyle, (s as { hovered?: boolean }).hovered && styles.rowHover]} accessibilityRole="button">
              {content}
            </Pressable>
          ) : (
            <View key={key} style={rowStyle}>
              {content}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  table: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  headerRow: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  bodyRow: { borderBottomWidth: 1, borderBottomColor: colors.surface, minHeight: 48 },
  rowHover: { backgroundColor: '#F6F8FB' },
  rowSelected: { backgroundColor: colors.restBg },
  rowAlert: { backgroundColor: colors.alertBg },
  rowSuccess: { backgroundColor: colors.successBg },
  cell: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: 'center' },
  headerText: { fontSize: 12, fontWeight: font.weight.bold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  cellText: { fontSize: font.size.sm + 1, color: colors.text },
  right: { textAlign: 'right', fontVariant: ['tabular-nums'] },
  empty: { padding: spacing.lg, color: colors.textMuted, fontSize: font.size.md },
});
