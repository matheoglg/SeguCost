import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';

import { ToastHost } from '@/components/Toast';
import { colors } from '@/theme';

// Inter is the typeface of the Figma design (CLAUDE.md section 5). On the web it is loaded once from
// Google Fonts and applied to every element; without connection the system sans-serif is used.
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('segucost-font')) {
  const link = document.createElement('link');
  link.id = 'segucost-font';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
  document.head.appendChild(link);
  const style = document.createElement('style');
  style.textContent = `body, body * { font-family: Inter, "Segoe UI", system-ui, sans-serif !important; }
input::placeholder { color: ${colors.textMuted}; }`;
  document.head.appendChild(style);
}

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.page } }} />
      <ToastHost />
    </>
  );
}
