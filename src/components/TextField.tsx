import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, font, radius, spacing } from '@/theme';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Validation message shown next to the field (RNF-04). */
  error?: string;
  hint?: string;
  large?: boolean;
}

export function TextField({ label, error, hint, large, ...input }: TextFieldProps) {
  return (
    <View style={styles.wrapper}>
      {!!label && <Text style={[styles.label, large && styles.largeLabel]}>{label}</Text>}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        {...input}
        style={[styles.input, large && styles.large, !!error && styles.inputError, input.editable === false && styles.readOnly]}
      />
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.text },
  input: {
    minHeight: 44,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    fontSize: font.size.md,
    color: colors.text,
    backgroundColor: colors.background,
  },
  large: { minHeight: 56, fontSize: font.size.xl },
  largeLabel: { fontSize: font.size.md },
  inputError: { borderColor: colors.alert },
  readOnly: { backgroundColor: colors.surface },
  error: { fontSize: font.size.sm, color: colors.alert },
  hint: { fontSize: font.size.sm, color: colors.textMuted },
});
