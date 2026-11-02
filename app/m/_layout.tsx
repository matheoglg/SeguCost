// Plant app stack (Android). One task per screen with a large header (RNF-02, RI-02).
import { Stack } from 'expo-router';

import { colors, font } from '@/theme';

export default function MobileLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.onPrimary,
        headerTitleStyle: { fontSize: font.size.lg, fontWeight: font.weight.bold },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="ordenes/index" options={{ title: 'Mis órdenes' }} />
      <Stack.Screen name="etapas/[id]" options={{ title: 'Detalle de etapa' }} />
      <Stack.Screen name="operacion" options={{ title: 'Operación en curso' }} />
      <Stack.Screen name="produccion" options={{ title: 'Registrar producción' }} />
      <Stack.Screen name="merma" options={{ title: 'Registrar merma' }} />
      <Stack.Screen name="cierre" options={{ title: 'Cierre en empacado' }} />
      <Stack.Screen name="turno" options={{ title: 'Resumen de turno' }} />
      <Stack.Screen name="planta" options={{ title: 'Planta' }} />
    </Stack>
  );
}
