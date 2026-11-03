// Save confirmations and errors (RNF-04). Call showToast() from any screen; ToastHost renders them.
import { StyleSheet, Text, View } from 'react-native';
import { create } from 'zustand';

import { colors, font, radius, spacing } from '@/theme';
import { Icon } from './Icon';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const useToastStore = create<{ toasts: ToastItem[] }>(() => ({ toasts: [] }));
let seq = 0;

export function showToast(kind: ToastKind, message: string, durationMs = 3500) {
  const id = ++seq;
  // One toast at a time: the newest replaces the previous one so it never covers the screen.
  useToastStore.setState({ toasts: [{ id, kind, message }] });
  setTimeout(() => useToastStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), durationMs);
}

const STYLE: Record<ToastKind, { bg: string; fg: string }> = {
  success: { bg: colors.success, fg: colors.onPrimary },
  error: { bg: colors.alert, fg: colors.onPrimary },
  info: { bg: colors.primary, fg: colors.onPrimary },
};

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  if (!toasts.length) return null;
  return (
    <View style={styles.host} pointerEvents="none">
      {toasts.map((t) => (
        <View key={t.id} testID="toast" style={[styles.toast, { backgroundColor: STYLE[t.kind].bg }]} accessibilityLiveRegion="assertive" accessibilityRole="alert">
          <Icon name={t.kind === 'error' ? 'alert' : 'check'} color={STYLE[t.kind].fg} />
          <Text style={[styles.text, { color: STYLE[t.kind].fg }]}>{t.message}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', top: spacing.lg, left: spacing.lg, right: spacing.lg, alignItems: 'center', gap: spacing.sm, zIndex: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: 520,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  text: { fontSize: font.size.md, fontWeight: font.weight.medium, flexShrink: 1 },
});
