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
  /** Own border and rounded corners, as the stand-alone tables of the captures. */
  framed?: boolean;
  /** Footer row inside the frame (totals, pagination). */
  footer?: ReactNode;
  testID?: string;
}

export function DataTable<T>({ columns, rows, rowKey, onRowPress, selectedKey, emptyText = 'Sin registros.', highlight, framed, footer, testID }: DataTableProps<T>) {
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
    <ScrollView
      horizontal
      style={framed && styles.frame}
      contentContainerStyle={styles.scroll}
      testID={testID}
      onLayout={(e) => setAvailable(e.nativeEvent.layout.width - (framed ? 2 : 0))}
    >
      <View style={[styles.table, { width: Math.max(minWidth, available) }]}>
        <View style={[styles.row, styles.headerRow]}>
          {columns.map((c) => (
            <View key={c.key} style={[styles.cell, cell(c)]}>
              <Text style={[styles.headerText, c.align === 'right' && styles.right]}>{c.title}</Text>
            </View>
          ))}
        </View>
        {rows.length === 0 && <Text style={styles.empty}>{emptyText}</Text>}
        {rows.map((row, i) => {
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
            i === rows.length - 1 && !footer && styles.lastRow,
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
        {footer}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  table: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  frame: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.background },
  headerRow: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, minHeight: 41, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  bodyRow: { borderBottomWidth: 1, borderBottomColor: colors.border, minHeight: 48, backgroundColor: colors.background, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  lastRow: { borderBottomWidth: 0 },
  rowHover: { backgroundColor: '#F7F9FC' },
  rowSelected: { backgroundColor: '#E8EFF8', borderLeftColor: colors.primary },
  rowAlert: { backgroundColor: colors.alertBg },
  rowSuccess: { backgroundColor: colors.successBg },
  cell: { paddingHorizontal: spacing.lg, paddingVertical: 10, justifyContent: 'center' },
  headerText: { fontSize: 12, fontWeight: font.weight.semibold, color: colors.textMuted },
  cellText: { fontSize: 15, color: colors.text },
  right: { textAlign: 'right', fontVariant: ['tabular-nums'] },
  empty: { padding: spacing.lg, color: colors.textMuted, fontSize: font.size.md },
});
