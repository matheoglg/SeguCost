# SeguCost — prototipo

Prototipo navegable de **SeguCost**, sistema de costeo y control de producción para SEGUPLAST S.A.
Proyecto de Ingeniería de Software I, ESPOL, Equipo T4. Requerimientos: [docs/srs_segucost_es.pdf](docs/srs_segucost_es.pdf).

Una sola base de código (Expo + React Native + TypeScript) genera la aplicación web (oficina) y la app Android (planta).
Usa datos simulados y no tiene backend.

## Requisitos

- Node.js 20 o superior
- Para Android: la app **Expo Go** en el teléfono, o un emulador de Android Studio

## Comandos

```bash
npm install
npx expo start            # desarrollo: w = web, a = Android (o escanear el QR con Expo Go)
npm test                  # pruebas de la lógica de dominio y de los datos de demostración
npm run typecheck         # verificación de tipos
npx expo export -p web    # build web en dist/
```

## Usuarios de demostración

Contraseña de todos: `demo123`.

| Usuario | Rol | Inicia en |
|---|---|---|
| `admin` | Administradora Principal | Panel principal |
| `ventas` | Jefe de Ventas | Panel principal |
| `contabilidad` | Responsable Contable | Panel principal |
| `facturacion` | Encargada de Facturación | Costos y precios vigentes |
| `rrhh` | Encargada de RR. HH. | Costos de recursos |
| `supervisor` | Supervisor de Planta | Monitor de planta (web) / Planta (móvil) |
| `operario1` | Operario de Producción (extrusión) | Mis órdenes (móvil) |
| `operario2` | Operario de Producción (sellado y empacado) | Mis órdenes (móvil) |

## Estructura

```
app/            rutas (Expo Router)
  login.tsx     P-01
  (web)/        pantallas web W-01 a W-22 (rutas sin prefijo: /panel, /pedidos, ...)
  m/            pantallas móviles M-01 a M-08 (rutas /m/...)
src/
  domain/       tipos y lógica pura con pruebas (conversión, rutas, permisos, costeo, precios)
  data/seed.ts  datos de demostración, generados relativos a la fecha actual
  store/        stores de Zustand
  navigation/   inventario de pantallas, menú por rol y pantalla de inicio por rol
  components/   UI compartida
  format.ts     números y fechas en formato de Ecuador (coma decimal)
  theme.ts      colores, tipografía y espaciados
docs/           SRS y documentos del proyecto
```
