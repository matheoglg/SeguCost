# SeguCost — prototipo

Prototipo navegable de **SeguCost**, sistema de costeo y control de producción para SEGUPLAST S.A.
Proyecto de Ingeniería de Software I, ESPOL, Equipo T4. Requerimientos: [docs/srs_segucost_es.pdf](docs/srs_segucost_es.pdf).

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

## Guía rápida de los 7 flujos

| Flujo | Usuario | Recorrido |
|---|---|---|
| 1. Catálogo | `admin` | Panel → Usuarios (Nuevo usuario) → Integración con Dobra › Importar › «Probar con archivo de ejemplo» → Insumos → Fundas (elegir tipo Impresa/Vivero) → Ver receta → Enviar a aprobación → Aprobación de recetas → Aprobar |
| 2. Precios y recursos | `contabilidad`, `admin`, `rrhh` | Proveedores y precios: PEBD · Polímeros Demo · 1,58 → Ver impacto en costos → Local vs. importado (cambiar el umbral) → Costos de recursos |
| 3. Pedido → orden | `ventas`, `supervisor` | Pedidos: Comercial Ejemplo, FI-4060, 10.000 → 125,00 kg / 275,58 lb · Guardar → (supervisor) Generar orden → asignar máquina y operarios → Liberar a planta |
| 4. Planta | `operario1`, `operario2` | (vista móvil) Mis órdenes → etapa de extrusión → Iniciar → Pausa activa / Reanudar → Registrar producción → Registrar merma → Finalizar · `operario2`: etapa de empacado → Finalizar y cerrar orden → Resumen de turno |
| 5. Supervisión | `supervisor` | Monitor de planta → «Abrir app móvil de planta» (alerta de merma de OP-0004) → OP-0003 Por validar → Corregir marcación → Validar cierre |
| 6. Costeo y precio | `admin`, `ventas`, `facturacion` | Costeo de orden → Simular precio → comparar 3 márgenes → Proponer → (admin) Aprobación de precios (justificar si está bajo el mínimo) → (facturacion) Costos y precios vigentes |
| 7. Análisis | `admin`, `contabilidad` | Reportes de tiempos → Descargar Excel → Tablero de costos y mermas (cambiar período) → Integración con Dobra › Generar archivo → Bitácora |

Los cambios de un flujo se mantienen mientras no se recargue la página, así que se puede cerrar sesión y entrar con otro rol para seguir el recorrido.

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
