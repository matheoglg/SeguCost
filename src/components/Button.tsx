import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, layout, radius, spacing } from '@/theme';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'rest' | 'ghost';

const VARIANTS: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
  secondary: { bg: colors.background, fg: colors.primary, border: colors.primary },
  danger: { bg: colors.alert, fg: colors.onPrimary, border: colors.alert },
  success: { bg: colors.activePause, fg: colors.onPrimary, border: colors.activePause },
  rest: { bg: colors.rest, fg: colors.onPrimary, border: colors.rest },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
};

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  /** 'lg' is the plant size: at least 56 dp high, 18 sp text (RNF-02). */
  size?: 'md' | 'lg';
  icon?: IconName;
  disabled?: boolean;
  fullWidth?: boolean;
  testID?: string;
}

export function Button({ title, onPress, variant = 'primary', size = 'md', icon, disabled, fullWidth, testID }: ButtonProps) {
  const v = VARIANTS[variant];
  const large = size === 'lg';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        large ? styles.large : styles.medium,
        { backgroundColor: v.bg, borderColor: v.border },
        fullWidth && styles.fullWidth,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.content}>
        {icon && <Icon name={icon} color={disabled ? colors.textMuted : v.fg} size={large ? 24 : 18} />}
        <Text style={[styles.text, { color: disabled ? colors.textMuted : v.fg, fontSize: large ? font.size.lg : font.size.md }]}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1.5, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  medium: { minHeight: 44, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  large: { minHeight: Math.max(56, layout.minTouch), paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { fontWeight: font.weight.bold, textAlign: 'center' },
  pressed: { opacity: 0.85 },
  disabled: { backgroundColor: colors.idleBg, borderColor: colors.border },
});
