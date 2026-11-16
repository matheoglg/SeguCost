import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, font, radius, spacing } from '@/theme';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Validation message shown next to the field (RNF-04). */
  error?: string;
  hint?: string;
  large?: boolean;
  /** Icon or short text inside the field, on the right (lock, "%", "USD"). */
  trailing?: ReactNode;
}

export function TextField({ label, error, hint, large, trailing, ...input }: TextFieldProps) {
  return (
    <View style={styles.wrapper}>
      {!!label && <Text style={[styles.label, large && styles.largeLabel]}>{label}</Text>}
      <View>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          {...input}
          style={[styles.input, large && styles.large, !!error && styles.inputError, input.editable === false && styles.readOnly, !!trailing && styles.withTrailing]}
        />
        {trailing && (
          <View style={styles.trailing} pointerEvents="none">
            {trailing}
          </View>
        )}
      </View>
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
  wrapper: { gap: 6 },
  label: { fontSize: 13, fontWeight: font.weight.medium, color: colors.text },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
  },
  large: { height: 52, fontSize: 18, borderRadius: 8 },
  largeLabel: { fontSize: font.size.md },
  inputError: { borderColor: colors.alert },
  readOnly: { backgroundColor: colors.surface, color: colors.textMuted },
  error: { fontSize: 12, color: colors.alert },
  withTrailing: { paddingRight: 40 },
  trailing: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },
  hint: { fontSize: 12, color: colors.textMuted },
});
