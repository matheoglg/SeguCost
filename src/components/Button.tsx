import { Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';

import { colors, font, layout, radius, spacing } from '@/theme';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'rest' | 'ghost';

const VARIANTS: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
  secondary: { bg: colors.background, fg: colors.primary, border: colors.primary },
  danger: { bg: colors.alert, fg: colors.onPrimary, border: colors.alert },
  success: { bg: colors.success, fg: colors.onPrimary, border: colors.success },
  rest: { bg: colors.rest, fg: colors.onPrimary, border: colors.rest },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
};

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  /** 'lg' is the plant size: 56 dp high, 18 sp text (RNF-02). 'sm' fits inside tables and cards. */
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  disabled?: boolean;
  fullWidth?: boolean;
  testID?: string;
}

export function Button({ title, onPress, variant = 'primary', size = 'md', icon, disabled, fullWidth, testID }: ButtonProps) {
  const v = VARIANTS[variant];
  const large = size === 'lg';
  const fg = disabled ? '#8B95A3' : v.fg;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        large ? styles.large : size === 'sm' ? styles.small : styles.medium,
        { backgroundColor: v.bg, borderColor: v.border },
        fullWidth && styles.fullWidth,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.content}>
        {icon && <Icon name={icon} color={fg} size={large ? 24 : 16} />}
        <Text style={[styles.text, { color: fg, fontSize: large ? 20 : size === 'sm' ? 14 : 15 }]}>{title}</Text>
      </View>
    </Pressable>
  );
}

/** Underlined text action ("Usar como referencia", "Cambiar archivo", "Corregir"). */
export function LinkButton({
  title,
  onPress,
  tone = 'info',
  style,
  testID,
  disabled,
}: {
  title: string;
  onPress?: () => void;
  tone?: 'info' | 'alert';
  style?: TextStyle;
  testID?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" testID={testID} disabled={disabled} hitSlop={8}>
      <Text style={[styles.link, { color: disabled ? colors.textMuted : tone === 'alert' ? colors.alert : colors.info }, style]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1.5, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  small: { minHeight: 36, paddingHorizontal: spacing.md, paddingVertical: 6 },
  medium: { minHeight: 42, paddingHorizontal: 18, paddingVertical: spacing.sm },
  large: { minHeight: Math.max(56, layout.minTouch), paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 12 },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { fontWeight: font.weight.semibold, textAlign: 'center' },
  pressed: { opacity: 0.85 },
  disabled: { backgroundColor: '#E1E5EB', borderColor: '#E1E5EB' },
  link: { fontSize: 14, fontWeight: font.weight.semibold, textDecorationLine: 'underline' },
});
