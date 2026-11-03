import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ToastHost } from '@/components/Toast';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
      <ToastHost />
    </>
  );
}
