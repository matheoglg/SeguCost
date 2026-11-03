// Form controls shared by web and mobile: picker, segmented control, tabs and checkbox.
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, spacing } from '@/theme';
import { Icon } from './Icon';

export interface Option<V extends string> {
  value: V;
  label: string;
  detail?: string;
}

/** Dropdown-like picker that opens a list in a modal (same behavior on web and Android). */
export function SelectField<V extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Seleccione…',
  error,
  disabled,
  testID,
}: {
  label: string;
  value?: V;
  options: Option<V>[];
  onChange: (value: V) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={styles.field}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.select, !!error && styles.selectError, disabled && styles.disabled]}
      >
        <Text style={[styles.selectText, !selected && styles.placeholder]} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <View style={{ transform: [{ rotate: '90deg' }] }}>
          <Icon name="chevronRight" color={colors.textMuted} size={18} />
        </View>
      </Pressable>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {options.map((o) => (
                <Pressable
                  key={o.value}
                  testID={testID ? `${testID}-${o.value}` : undefined}
                  accessibilityRole="button"
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  style={(s) => [styles.option, o.value === value && styles.optionSelected, (s as { hovered?: boolean }).hovered && styles.optionHover]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionText}>{o.label}</Text>
                    {o.detail && <Text style={styles.optionDetail}>{o.detail}</Text>}
                  </View>
                  {o.value === value && <Icon name="check" color={colors.primary} />}
                </Pressable>
              ))}
              {options.length === 0 && <Text style={styles.optionDetail}>No hay opciones disponibles.</Text>}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/** Few mutually exclusive options shown side by side. `large` for plant screens. */
export function Segmented<V extends string>({
  label,
  value,
  options,
  onChange,
  large,
  error,
  testID,
}: {
  label?: string;
  value?: V;
  options: Option<V>[];
  onChange: (value: V) => void;
  large?: boolean;
  error?: string;
  testID?: string;
}) {
  return (
    <View style={styles.field}>
      {label && <Text style={[styles.label, large && styles.largeLabel]}>{label}</Text>}
      <View style={[styles.segmented, large && styles.segmentedLarge]}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value}
              testID={testID ? `${testID}-${o.value}` : undefined}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(o.value)}
              style={[styles.segment, large && styles.segmentLarge, active && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, large && styles.segmentTextLarge, active && styles.segmentTextActive]}>{o.label}</Text>
              {o.detail && <Text style={[styles.segmentDetail, active && styles.segmentTextActive]}>{o.detail}</Text>}
            </Pressable>
          );
        })}
      </View>
      {!!error && <Text style={[styles.error, large && styles.largeLabel]}>{error}</Text>}
    </View>
  );
}

export function Tabs<V extends string>({ value, options, onChange }: { value: V; options: Option<V>[]; onChange: (v: V) => void }) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onChange(o.value)} style={[styles.tab, active && styles.tabActive]} testID={`tab-${o.value}`}>
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Checkbox({ label, checked, onChange, testID }: { label: string; checked: boolean; onChange: (v: boolean) => void; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onChange(!checked)} style={styles.checkRow}>
      <View style={[styles.box, checked && styles.boxChecked]}>{checked && <Icon name="check" color={colors.onPrimary} size={16} />}</View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.text },
  largeLabel: { fontSize: font.size.md },
  select: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },
  selectError: { borderColor: colors.alert },
  disabled: { backgroundColor: colors.surface },
  selectText: { flex: 1, fontSize: font.size.md, color: colors.text },
  placeholder: { color: colors.textMuted },
  error: { fontSize: font.size.sm, color: colors.alert },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  sheet: { width: '100%', maxWidth: 440, backgroundColor: colors.background, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  sheetTitle: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.primary, marginBottom: spacing.xs },
  option: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm },
  optionSelected: { backgroundColor: colors.restBg },
  optionHover: { backgroundColor: colors.surface },
  optionText: { fontSize: font.size.md, color: colors.text },
  optionDetail: { fontSize: font.size.sm, color: colors.textMuted },
  segmented: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  segmentedLarge: { flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch' },
  segment: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    justifyContent: 'center',
  },
  segmentLarge: { minHeight: 64, paddingHorizontal: spacing.lg, borderRadius: radius.md },
  segmentActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segmentText: { fontSize: font.size.sm + 1, color: colors.text, fontWeight: font.weight.medium },
  segmentTextLarge: { fontSize: font.size.lg, fontWeight: font.weight.bold },
  segmentTextActive: { color: colors.onPrimary },
  segmentDetail: { fontSize: font.size.sm, color: colors.textMuted },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.lg },
  tab: { paddingVertical: spacing.md, borderBottomWidth: 3, borderBottomColor: 'transparent', marginBottom: -1 },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: font.size.md, color: colors.textMuted, fontWeight: font.weight.medium },
  tabTextActive: { color: colors.primary, fontWeight: font.weight.bold },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 40 },
  box: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  boxChecked: { backgroundColor: colors.primary },
  checkLabel: { fontSize: font.size.md, color: colors.text },
});
