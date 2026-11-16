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
  hint,
  disabled,
  testID,
}: {
  label: string;
  value?: V;
  options: Option<V>[];
  onChange: (value: V) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
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
        <Icon name="chevronDown" color={colors.text} size={16} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
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

/** Connected toggle group ("Todas (4) | En proceso (2)", "Normal | Urgente"). */
export function ToggleGroup<V extends string>({ value, options, onChange, testID }: { value: V; options: Option<V>[]; onChange: (v: V) => void; testID?: string }) {
  return (
    <View style={styles.toggle} accessibilityRole="radiogroup">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={testID ? `${testID}-${o.value}` : undefined}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.toggleItem, active && styles.toggleActive]}
          >
            <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
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

/** Checkbox; `large` is the plant size (48 dp row, 16 sp text, RNF-02). */
export function Checkbox({ label, checked, onChange, testID, large, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; testID?: string; large?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={[styles.checkRow, large && styles.checkRowLarge]}
    >
      <View style={[styles.box, large && styles.boxLarge, checked && styles.boxChecked]}>
        {checked && <Icon name="check" color={colors.onPrimary} size={large ? 18 : 14} strokeWidth={2.5} />}
      </View>
      {!!label && <Text style={[styles.checkLabel, large && styles.checkLabelLarge]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: font.weight.medium, color: colors.text },
  largeLabel: { fontSize: font.size.md },
  select: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },
  selectError: { borderColor: colors.alert },
  disabled: { backgroundColor: colors.surface },
  selectText: { flex: 1, fontSize: 15, color: colors.text },
  placeholder: { color: colors.textMuted },
  error: { fontSize: 12, color: colors.alert },
  hint: { fontSize: 12, color: colors.textMuted },
  toggle: { flexDirection: 'row', alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: colors.background, overflow: 'hidden' },
  toggleItem: { paddingHorizontal: 14, height: 32, justifyContent: 'center' },
  toggleActive: { backgroundColor: colors.primary },
  toggleText: { fontSize: 14, color: colors.text, fontWeight: font.weight.medium },
  toggleTextActive: { color: colors.onPrimary, fontWeight: font.weight.semibold },
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
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  tab: { paddingHorizontal: spacing.lg, paddingTop: 6, paddingBottom: 14, borderBottomWidth: 3, borderBottomColor: 'transparent', marginBottom: -1 },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 15, color: colors.textMuted, fontWeight: font.weight.medium },
  tabTextActive: { color: colors.primary, fontWeight: font.weight.semibold },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 32 },
  box: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: colors.inputBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkLabel: { fontSize: 15, color: colors.text },
  checkRowLarge: { minHeight: 48, gap: 14 },
  boxLarge: { width: 26, height: 26, borderRadius: 5 },
  checkLabelLarge: { fontSize: 17 },
});
