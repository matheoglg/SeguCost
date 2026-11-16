# SeguCost — prototipo

Prototipo navegable de **SeguCost**, sistema de costeo y control de producción para SEGUPLAST S.A.
Proyecto de Ingeniería de Software I, ESPOL, Equipo T4. Requerimientos: [docs/srs_segucost_es.pdf](docs/srs_segucost_es.pdf) (SRS v2.0). Instrucciones de implementación: [CLAUDE.md](CLAUDE.md).

Una sola base de código (Expo + React Native + TypeScript) genera la aplicación web (oficina) y la app Android (planta).
Usa datos simulados y no tiene backend.

## Requisitos

- Node.js 22.18 o superior (el script de capturas se ejecuta como TypeScript directamente con Node)
- Para Android: la app **Expo Go** en el teléfono, o un emulador de Android Studio

## Abrir en el navegador

**Opción 1 — modo desarrollo** (se recarga al guardar cambios):

```bash
npm install          # solo la primera vez
npm run web
```

Se abre solo en el navegador; si no, entrar a **http://localhost:8081**. Para detenerlo, `Ctrl + C` en la terminal.

**Opción 2 — build estática** (igual a la que se usa para las capturas):

```bash
npx expo export -p web     # genera la carpeta dist/
npm run serve              # sirve dist/ en http://localhost:3000
```

Consejos para recorrer el prototipo:

- La aplicación web está diseñada para pantallas de **1280 px o más**. Con la ventana más angosta, el menú lateral se abre con el botón ☰.
- Para ver la **app móvil** en el navegador, abrir las herramientas de desarrollo (`F12`), activar la vista de dispositivo (`Ctrl + Shift + M`) y elegir un teléfono (por ejemplo 390 × 844). Luego ingresar como `operario1` u `operario2`.
- Los datos viven en memoria: al recargar la página (`F5`) se vuelve a los datos de demostración y hay que iniciar sesión de nuevo.

## Abrir en Android

```bash
npx expo start
```

Escanear el código QR con la app **Expo Go** (el teléfono y el computador deben estar en la misma red WiFi), o presionar `a` para abrirla en un emulador de Android.

## Capturas para el SRS (Apéndice B)

```bash
npx playwright install chromium   # solo la primera vez
npm run capture                   # usa dist/ (la genera si no existe)
npm run capture -- --build        # vuelve a generar dist/ antes de capturar
npm run capture -- W-07 M-03      # solo esas pantallas
```

Guarda `capturas/P-01-web.png`, `capturas/P-01-movil.png`, `capturas/W-01.png` … `capturas/W-22.png` y `capturas/M-01.png` … `capturas/M-08.png`
(web a 1440 × 900; móvil a 390 × 844 con densidad 2). Cada captura inicia sesión con el usuario del rol y prepara la pantalla
(por ejemplo, llena el pedido de 10.000 FI-4060 en W-07 o inicia una operación en M-03).

## Otros comandos

```bash
npm test                  # pruebas de dominio, datos de demostración y los 7 flujos
npm run test:coverage     # pruebas con cobertura (costing.ts debe tener al menos 80 %)
npm run typecheck         # verificación de tipos
```

## Guía rápida de los flujos

La aplicación se está actualizando al SRS v2.0 (`CLAUDE.md`, capturas en `docs/capturas/`), flujo por flujo.

| Flujo | Usuario | Recorrido | Estado |
|---|---|---|---|
| 1. Configuración inicial | `admin` | Panel principal → Usuarios y roles › Nueva cuenta (probar el usuario `supervisor` para ver la sugerencia) → Importar y exportar › «ejemplo con errores» (2 filas con error, no importa nada) › «ejemplo corregido» › Importar → Materias primas e insumos (aparece ADT-02) → Parámetros de costeo (tocar un cargo, nueva tarifa, Guardar cambios) → Precios de materias primas › Registrar precio / Usar como referencia | Listo (v2.0) |
| 2 a 7 | — | Se actualizan en orden. Mientras tanto, el menú muestra la pantalla de cada uno con el aviso del flujo en que se completa; las pantallas móviles siguen en la versión anterior. | En curso |

Los cambios de un flujo se mantienen mientras no se recargue la página, así que se puede cerrar sesión y entrar con otro rol para seguir el recorrido.

## Usuarios de demostración

Contraseña de todos: `demo123`.

| Usuario | Nombre | Rol | Inicia en |
|---|---|---|---|
| `admin` | Bélgica Loza | Administradora Principal | Panel principal |
| `ventas` | Daniel Ríos | Jefe de Ventas | Panel principal |
| `supervisor` | Jorge Castillo | Supervisor de Planta | Panel principal (web) / Seguimiento (móvil) |
| `operario1` | Luis Bravo | Operario de Producción (extrusión) | Mis actividades (móvil) |
| `operario2` | Pedro Alvarado | Operario de Producción (sellado y empacado) | Mis actividades (móvil) |
| `aruiz` | Ana Ruiz | Operario de Producción (impresión) | Mis actividades (móvil) |
| `operario3` | Carlos Vera | Operario de Producción (cuenta inactiva) | — |

## Estructura

```
app/            rutas (Expo Router)
  login.tsx     P-01
  (web)/        pantallas web W-01 a W-22 (rutas sin prefijo: /panel, /pedidos, ...)
  m/            pantallas móviles M-01 a M-08 (rutas /m/...)
src/
  domain/       tipos y lógica pura con pruebas (conversión, rutas, permisos, costeo, precios,
                producción, reportes, archivos de Dobra)
  data/seed.ts  datos de demostración, generados relativos a la fecha actual
  store/        stores de Zustand: datos, sesión, interfaz y acciones de negocio (con bitácora)
  navigation/   inventario de pantallas, menú por rol y pantalla de inicio por rol
  components/   UI compartida (web, móvil y gráficos)
  format.ts     números y fechas en formato de Ecuador (coma decimal)
  xlsx.ts       generador mínimo de Excel para los reportes
  theme.ts      colores, tipografía y espaciados
scripts/capture.ts  capturas con Playwright
capturas/       imágenes para el Apéndice B del SRS
docs/           SRS y documentos del proyecto
```
