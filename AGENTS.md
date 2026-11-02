# AGENTS.md — Prototipo SeguCost (web + móvil)

Instrucciones para el agente de código que construirá el prototipo de **SeguCost**, sistema de costeo y control de producción para SEGUPLAST S.A. (fábrica de fundas plásticas, Guayaquil). Proyecto de Ingeniería de Software I, ESPOL, Equipo T4.

Los requerimientos completos están en el SRS v1.0 (`docs/srs_segucost_es.pdf`). Este archivo resume lo necesario para construir el prototipo. Si algo aquí contradice al SRS, manda el SRS.

## 1. Objetivo

- Prototipo **navegable de alta fidelidad**, con **datos simulados** y **sin backend real**.
- **Una sola base de código** que genere la **aplicación web** (oficina, computador) y la **app móvil Android** (planta).
- Cada pantalla debe mostrar los requerimientos funcionales indicados en la sección 6 y respetar las reglas de la sección 5.
- Debe permitir recorrer los 7 flujos de la sección 7 de principio a fin.
- Debe generar las capturas que usa el Apéndice B del SRS (sección 9).

## 2. Stack

- **Expo** (React Native) con **TypeScript** y **Expo Router**, creado con `npx create-expo-app@latest`. La web se sirve con `react-native-web` (incluido en Expo).
- Estado: **Zustand**. Persistencia local opcional con `@react-native-async-storage/async-storage` (para simular la cola offline).
- Gráficos: `victory-native` o `react-native-svg` con componentes propios; deben funcionar en web y móvil.
- Pruebas: **Jest** (`jest-expo`) para la lógica de dominio.
- Capturas: **Playwright** sobre la build web (`npx expo export -p web` y un servidor estático).
- No agregar servicios externos, claves, analítica ni login real.

## 3. Estructura sugerida

```
app/
  _layout.tsx            # proveedor de sesión y tema
  login.tsx              # P-01
  (web)/_layout.tsx      # shell con menú lateral (ancho >= 1024 px)
  (web)/panel.tsx ...    # W-01 a W-22
  (movil)/_layout.tsx    # stack móvil con encabezado grande
  (movil)/ordenes.tsx ...# M-01 a M-08
src/
  domain/                # tipos y lógica pura: conversion.ts, routing.ts, costing.ts, pricing.ts, permissions.ts
  data/seed.ts           # datos de demostración (sección 8)
  store/                 # stores de Zustand por módulo
  components/            # UI compartida: Button, Card, DataTable, Timer, StatusBadge, KpiCard, Chart
  theme.ts               # colores, tipografía, espaciados
scripts/capture.ts       # capturas con Playwright
capturas/                # salida de capturas (ver sección 9)
docs/                    # SRS y documentos del proyecto
```

Navegación por rol: al iniciar sesión, `ope` va a `(movil)/ordenes`; `sup` va a `(web)/planta` en pantallas anchas y a `(movil)/planta` en pantallas angostas; los demás roles van a `(web)/panel`. En la app Android, los roles de oficina ven las mismas pantallas web en formato responsivo.

## 4. Lógica de dominio (con pruebas)

Implementar como funciones puras en `src/domain/` y cubrir con Jest (cobertura mínima 80 % en `costing.ts`, RNF-23). Los casos de prueba salen de los criterios de aceptación del SRS:

| Función | Regla | Caso de prueba |
|---|---|---|
| `unitsToWeight` (RF-10) | kg = cantidad × peso_g / 1000; lb = kg × 2.20462 | 10 000 × 4 g → 40.00 kg / 88.18 lb |
| `buildRoute` (RF-11) | natural: extrusión, sellado, empacado; impresa: + impresión tras extrusión; vivero: + troquelado tras sellado | impresa → [EXT, IMP, SEL, EMP] |
| `wastePercent` / `isWasteAlert` (RF-16, RF-17) | % = merma_kg / mp_usada_kg; alerta si > umbral (3 %) | 3.5 % → alerta; 2.9 % → sin alerta |
| `effectiveTime` (RF-23) | tiempo total − pausas activas − descansos | 60 min con 10 min de pausa → 50 min |
| `materialCost` (RF-31) | Σ consumo × precio vigente; 0 si es servicio a terceros | servicio → 0 |
| `laborCost`, `machineCost` (RF-32) | Σ horas efectivas × costo hora cargo; Σ horas máquina × costo hora | 2 h × 3.00 → 6.00 USD |
| `orderCost` (RF-33) | CT = CM + CMO + CMQ − VR; CU = CT / unidades contadas | CT 200.00 y 10 000 u → CU 0.0200 |
| `recalcStandardCosts` (RF-34) | recalcula solo fundas cuya receta aprobada usa el insumo; órdenes cerradas no cambian | — |
| `priceFromMargin` (RF-36) | sobre costo: CU × (1+m); sobre precio: CU / (1−m) | 0.0200 al 25 % → 0.0250 / 0.0267 |
| `belowMinimum` (RF-37) | margen < mínimo de la línea | 15 % con mínimo 20 % → true |
| `suggestPurchase` (RF-28) | diferencia % entre mejor local e importado; local si < umbral (10 %) | 1.50 vs 1.40 → 6.7 % → local |
| `canTransition` (RF-20) | Pendiente→En proceso→Por validar→Cerrada; Por validar→En proceso; Pendiente→Anulada | Cerrada→En proceso → false |
| `can(role, feature)` (RF-03) | matriz de permisos (Tabla 5.1 del SRS) | ope no ve costos |

Redondeo: totales a 2 decimales y unitarios a 4 (RNF-20). Mostrar números con coma decimal (`Intl.NumberFormat('es-EC')`).

## 5. Reglas de interfaz

- Todo el texto visible en **español**. Identificadores de código en inglés.
- Colores: primario azul marino `#002855`, fondo `#FFFFFF`, superficie `#EEF1F6`, éxito `#1B7F3B`, alerta `#B3261E`, pausa activa verde, descanso azul. Contraste mínimo 4.5:1 (RNF-19).
- Móvil: una tarea por pantalla, botones ≥ 48×48 dp, texto ≥ 16 sp, cronómetro siempre visible en M-03 (RNF-02, RI-02).
- Web: menú lateral filtrado por rol, encabezado con nombre y rol del usuario (RI-01). Diseño desde 1280 px (RNF-17).
- Toda acción de guardado muestra un aviso de éxito o error (RNF-04). Los errores de validación aparecen junto al campo.
- Simular la cola offline en móvil: un interruptor en M-01 "Simular sin conexión" que guarda marcaciones y muestra "Sin conexión: se sincronizará al volver la señal" (RNF-11).
- Simular tiempo real entre móvil y web con el store compartido (en web y móvil corren en el mismo dispositivo durante la demo; basta con que el monitor W-10 lea del store).

## 6. Pantallas

Implementar todas. La columna RF dice qué requerimientos debe evidenciar cada pantalla.

| ID | Pantalla | Plataforma | Ruta | Roles | RF |
|---|---|---|---|---|---|
| P-01 | Inicio de sesión | Web y móvil | `/login` | Todos los roles | RF-01, RF-03 |
| W-01 | Panel principal | Web | `/panel` | Administradora Principal, Jefe de Ventas, Responsable Contable, Encargada de Facturación, Encargada de RR. HH., Supervisor de Planta | RF-03, RF-42 |
| W-02 | Usuarios y roles | Web | `/usuarios` | Administradora Principal | RF-02, RF-03 |
| W-03 | Materias primas e insumos | Web | `/insumos` | Administradora Principal | RF-05 |
| W-04 | Fundas | Web | `/fundas` | Administradora Principal, Supervisor de Planta | RF-06 |
| W-05 | Recetas (BOM) | Web | `/recetas/:funda` | Administradora Principal, Supervisor de Planta | RF-07 |
| W-06 | Aprobación de recetas | Web | `/recetas/aprobacion` | Administradora Principal | RF-08, RF-04 |
| W-07 | Pedidos | Web | `/pedidos` | Administradora Principal, Jefe de Ventas, Supervisor de Planta | RF-09, RF-10, RF-13 |
| W-08 | Órdenes de producción | Web | `/ordenes/nueva` | Supervisor de Planta | RF-11, RF-12, RF-20 |
| W-09 | Detalle y validación de orden | Web | `/ordenes/:id` | Supervisor de Planta, Administradora Principal | RF-15, RF-16, RF-17, RF-19, RF-20, RF-22 |
| W-10 | Monitor de planta | Web | `/planta` | Supervisor de Planta | RF-25 |
| W-11 | Proveedores y precios | Web | `/precios` | Responsable Contable, Administradora Principal | RF-26, RF-27 |
| W-12 | Comparador local vs. importado | Web | `/precios/comparar` | Administradora Principal, Responsable Contable | RF-28 |
| W-13 | Costos de recursos | Web | `/recursos` | Administradora Principal, Encargada de RR. HH. | RF-29, RF-30 |
| W-14 | Costeo de orden | Web | `/costos/ordenes/:id` | Administradora Principal, Jefe de Ventas, Responsable Contable, Supervisor de Planta | RF-31, RF-32, RF-33, RF-35 |
| W-15 | Impacto de cambio de precio | Web | `/costos/impacto` | Administradora Principal, Responsable Contable | RF-34 |
| W-16 | Simulador de márgenes | Web | `/precios/simulador` | Jefe de Ventas, Administradora Principal | RF-36, RF-37 |
| W-17 | Aprobación de precios | Web | `/precios/aprobacion` | Administradora Principal | RF-37, RF-38, RF-04 |
| W-18 | Costos y precios vigentes | Web | `/consulta` | Encargada de Facturación, Jefe de Ventas, Responsable Contable, Administradora Principal | RF-39 |
| W-19 | Reportes de tiempos | Web | `/reportes/tiempos` | Administradora Principal, Supervisor de Planta | RF-40, RF-41 |
| W-20 | Tablero de costos y mermas | Web | `/reportes/tablero` | Administradora Principal, Responsable Contable | RF-42 |
| W-21 | Integración con Dobra | Web | `/integracion` | Administradora Principal, Responsable Contable | RF-43, RF-44, RF-04 |
| W-22 | Bitácora | Web | `/bitacora` | Administradora Principal | RF-04 |
| M-01 | Mis órdenes | Móvil | `/m/ordenes` | Operario de Producción, Supervisor de Planta | RF-14, RF-03 |
| M-02 | Detalle de etapa | Móvil | `/m/etapas/:id` | Operario de Producción | RF-14, RF-21 |
| M-03 | Operación en curso | Móvil | `/m/operacion` | Operario de Producción | RF-21, RF-23 |
| M-04 | Registrar producción | Móvil | `/m/produccion` | Operario de Producción | RF-15 |
| M-05 | Registrar merma | Móvil | `/m/merma` | Operario de Producción | RF-16, RF-17 |
| M-06 | Cierre en empacado | Móvil | `/m/cierre` | Operario de Producción | RF-18 |
| M-07 | Resumen de turno | Móvil | `/m/turno` | Operario de Producción | RF-24 |
| M-08 | Planta (supervisor) | Móvil | `/m/planta` | Supervisor de Planta | RF-25, RF-17 |

### P-01 — Inicio de sesión

*Entrada única a SeguCost. Según el rol, lleva al panel web o a la app móvil.* Ruta `/login`. RF: RF-01, RF-03.

Contenido:
- Logo de SEGUPLAST y nombre del sistema
- Campos usuario y contraseña
- Botón Ingresar
- Mensaje de error genérico
- Accesos rápidos de demostración (un usuario por rol)

Acciones:
- Ingresar como operario → M-01 Mis órdenes
- Ingresar con otro rol → W-01 Panel principal
- Credenciales erróneas → mensaje "Usuario o contraseña incorrectos"

### W-01 — Panel principal

*Pantalla de inicio de cada rol de oficina con indicadores y accesos a sus tareas.* Ruta `/panel`. RF: RF-03, RF-42.

Contenido:
- Menú lateral filtrado por rol
- Tarjetas: órdenes en proceso, órdenes por validar, costo unitario promedio del mes, merma del mes
- Lista de pendientes del rol (recetas por aprobar, precios por aprobar)
- Gráfico pequeño de costo unitario de los últimos 6 meses

Acciones:
- Clic en una tarjeta → pantalla del módulo
- Clic en un pendiente → W-06 o W-17

### W-02 — Usuarios y roles

*Administración de cuentas y consulta de la matriz de permisos.* Ruta `/usuarios`. RF: RF-02, RF-03.

Contenido:
- Tabla de usuarios (nombre, usuario, rol, estado)
- Botón Nuevo usuario
- Formulario lateral: nombres, usuario, rol, estado
- Pestaña Matriz de permisos (solo lectura)

Acciones:
- Guardar → usuario agregado a la tabla
- Desactivar → estado Inactivo
- Usuario repetido → error en el campo

### W-03 — Materias primas e insumos

*Catálogo de materiales usados en recetas y precios.* Ruta `/insumos`. RF: RF-05.

Contenido:
- Tabla con nombre, tipo, unidad y estado
- Buscador por nombre y filtro por tipo
- Formulario: nombre, tipo (resina, pigmento, tinta, aditivo, reciclado), unidad

Acciones:
- Guardar → insumo en la tabla
- Desactivar → ya no aparece en recetas nuevas

### W-04 — Fundas

*Catálogo de productos con sus especificaciones.* Ruta `/fundas`. RF: RF-06.

Contenido:
- Tabla con código, nombre, medidas, calibre, peso por unidad y tipo
- Formulario con ancho, largo, calibre, peso (g), tipo y línea
- Vista previa de la ruta de etapas según el tipo

Acciones:
- Elegir tipo Impresa → la ruta muestra Impresión
- Elegir tipo Vivero → la ruta muestra Troquelado
- Guardar → funda en la tabla; botón Ver receta → W-05

### W-05 — Recetas (BOM)

*Edición de la receta por kilogramo y consulta de versiones.* Ruta `/recetas/:funda`. RF: RF-07.

Contenido:
- Encabezado con funda y estado de la receta
- Tabla editable: insumo, cantidad por kg, unidad
- Costo estándar estimado por kg con precios vigentes
- Historial de versiones

Acciones:
- Agregar insumo → nueva fila
- Enviar a aprobación → estado Borrador en W-06
- Editar receta aprobada → se crea versión nueva

### W-06 — Aprobación de recetas

*Bandeja de recetas en borrador para aprobar o rechazar.* Ruta `/recetas/aprobacion`. RF: RF-08, RF-04.

Contenido:
- Lista de recetas en Borrador
- Detalle con insumos y diferencia frente a la versión anterior
- Botones Aprobar y Rechazar
- Campo Motivo (obligatorio al rechazar)

Acciones:
- Aprobar → estado Aprobada y registro en bitácora
- Rechazar sin motivo → error

### W-07 — Pedidos

*Registro de pedidos de clientes y servicios a terceros con conversión a peso.* Ruta `/pedidos`. RF: RF-09, RF-10, RF-13.

Contenido:
- Tabla de pedidos con estado
- Formulario: cliente, funda, cantidad, fecha de entrega
- Casilla Servicio a terceros y campo kg de materia prima recibida
- Resultado de conversión: kg y lb

Acciones:
- Ingresar 10.000 fundas de 4 g → muestra 40,00 kg / 88,18 lb
- Guardar → pedido Pendiente
- Generar orden → W-08

### W-08 — Órdenes de producción

*Generación de la orden con su ruta y asignación de máquina y operarios por etapa.* Ruta `/ordenes/nueva`. RF: RF-11, RF-12, RF-20.

Contenido:
- Datos del pedido y peso a producir
- Receta aprobada vigente usada
- Ruta de etapas como pasos numerados
- Por etapa: selector de máquina (filtrado por sección) y operarios

Acciones:
- Liberar a planta con todo asignado → orden Pendiente visible en M-01
- Falta máquina u operario → botón Liberar deshabilitado

### W-09 — Detalle y validación de orden

*Seguimiento de una orden y validación de su cierre.* Ruta `/ordenes/:id`. RF: RF-15, RF-16, RF-17, RF-19, RF-20, RF-22.

Contenido:
- Línea de tiempo de etapas con estado
- Registros de producción, mermas y tiempos por etapa
- Indicador de % de merma con alerta si supera el umbral
- Botones Validar cierre y Devolver con observación
- Opción Corregir marcación con motivo

Acciones:
- Validar → orden Cerrada y costo calculado en W-14
- Devolver → orden En proceso y aviso al operario

### W-10 — Monitor de planta

*Estado de cada máquina en tiempo real.* Ruta `/planta`. RF: RF-25.

Contenido:
- Tarjetas por máquina: código, sección, estado (Operando, Detenida, En pausa), operario y tiempo en el estado
- Filtro por sección
- Marca de hora de la última actualización

Acciones:
- Clic en una máquina → W-09 de la orden en curso

### W-11 — Proveedores y precios

*Registro de precios por proveedor y su historial.* Ruta `/precios`. RF: RF-26, RF-27.

Contenido:
- Tabla de precios vigentes por insumo y proveedor
- Formulario: insumo, proveedor, precio, origen, plazo en días, vigencia
- Historial con gráfico de línea por insumo

Acciones:
- Guardar precio nuevo → aviso de fundas afectadas → W-15
- Origen importado sin plazo → error

### W-12 — Comparador local vs. importado

*Apoyo a la decisión de compra.* Ruta `/precios/comparar`. RF: RF-28.

Contenido:
- Selector de materia prima
- Tabla: proveedor, origen, precio, días de llegada
- Diferencia porcentual y umbral configurado
- Etiqueta de sugerencia: Comprar local / Evaluar importación

Acciones:
- Cambiar umbral → se actualiza la sugerencia

### W-13 — Costos de recursos

*Costo por hora de cargos de planta y de máquinas.* Ruta `/recursos`. RF: RF-29, RF-30.

Contenido:
- Pestaña Mano de obra: cargo, costo por hora, vigencia
- Pestaña Máquinas: máquina, costo hora, vigencia
- Historial por fila

Acciones:
- Guardar → nuevo valor vigente y anterior en historial

### W-14 — Costeo de orden

*Resultado del costeo automático de una orden cerrada.* Ruta `/costos/ordenes/:id`. RF: RF-31, RF-32, RF-33, RF-35.

Contenido:
- Tarjetas: costo de materiales, mano de obra, máquina, merma recuperada, total y unitario
- Tabla de detalle por insumo, operario y máquina
- Etiqueta Servicio a terceros cuando aplica
- Botón Simular precio

Acciones:
- Simular precio → W-16 con el costo unitario cargado

### W-15 — Impacto de cambio de precio

*Recálculo de costos estándar tras actualizar un precio.* Ruta `/costos/impacto`. RF: RF-34.

Contenido:
- Resumen del cambio (insumo, precio anterior y nuevo)
- Tabla de fundas afectadas: costo anterior, nuevo y variación %
- Nota: las órdenes cerradas no cambian

Acciones:
- Ir a simulador desde una fila → W-16

### W-16 — Simulador de márgenes

*Cálculo del precio de venta con distintos márgenes.* Ruta `/precios/simulador`. RF: RF-36, RF-37.

Contenido:
- Selector de funda y costo unitario vigente
- Hasta tres columnas de margen para comparar
- Método (sobre costo o sobre precio) según configuración
- Ganancia por unidad y por pedido
- Marca roja si el margen queda bajo el mínimo de la línea

Acciones:
- Proponer precio → propuesta enviada a W-17

### W-17 — Aprobación de precios

*Bandeja de propuestas de precio referencial.* Ruta `/precios/aprobacion`. RF: RF-37, RF-38, RF-04.

Contenido:
- Lista de propuestas con margen y marca bajo mínimo
- Campo Justificación (obligatorio si está bajo el mínimo)
- Botones Aprobar y Rechazar
- Historial de precios de la funda

Acciones:
- Aprobar → precio vigente y visible en W-18

### W-18 — Costos y precios vigentes

*Consulta de solo lectura para facturación y ventas.* Ruta `/consulta`. RF: RF-39.

Contenido:
- Buscador por código o nombre
- Tabla: funda, costo unitario estándar, precio referencial, fecha de actualización

Acciones:
- Sin acciones de edición

### W-19 — Reportes de tiempos

*Análisis de tiempo efectivo, pausas y uso de máquinas.* Ruta `/reportes/tiempos`. RF: RF-40, RF-41.

Contenido:
- Filtros: fechas, operario, máquina
- Tabla con tiempo efectivo, pausas activas, descansos, tiempo de máquina y % efectivo
- Gráfico de barras apiladas por operario
- Botones Descargar Excel y Descargar PDF

Acciones:
- Descargar → archivo con los mismos filtros

### W-20 — Tablero de costos y mermas

*Evolución de costos, precios de insumos y mermas.* Ruta `/reportes/tablero`. RF: RF-42.

Contenido:
- Selector de período
- Gráfico de costo unitario mensual por funda
- Gráfico de precio por insumo y proveedor
- Gráfico de % de merma por sección

Acciones:
- Cambiar período → se actualizan los tres gráficos

### W-21 — Integración con Dobra

*Exportación de costos y precios, e importación del catálogo inicial.* Ruta `/integracion`. RF: RF-43, RF-44, RF-04.

Contenido:
- Pestaña Exportar: selección de fundas con precio aprobado, botón Generar archivo, historial de exportaciones
- Pestaña Importar: descarga de plantilla, carga de archivo, resumen de filas cargadas y rechazadas

Acciones:
- Generar archivo → descarga y registro en historial
- Cargar plantilla con errores → lista de filas rechazadas con motivo

### W-22 — Bitácora

*Consulta de operaciones registradas.* Ruta `/bitacora`. RF: RF-04.

Contenido:
- Tabla: fecha, usuario, entidad, acción, valor anterior y nuevo
- Filtros por usuario, entidad y fecha

Acciones:
- Solo consulta

### M-01 — Mis órdenes

*Lista de etapas asignadas al operario.* Ruta `/m/ordenes`. RF: RF-14, RF-03.

Contenido:
- Saludo con nombre y turno
- Tarjetas grandes por etapa: orden, funda, medidas, peso o unidades a producir, máquina, fecha de entrega
- Indicador de operación en curso si existe
- Accesos a Resumen de turno

Acciones:
- Tocar una tarjeta → M-02
- Tocar operación en curso → M-03

### M-02 — Detalle de etapa

*Información de la etapa antes de empezar.* Ruta `/m/etapas/:id`. RF: RF-14, RF-21.

Contenido:
- Funda, medidas, calibre y tipo
- Meta de la etapa (kg o unidades)
- Máquina asignada
- Botón grande Iniciar operación

Acciones:
- Iniciar operación → M-03 con cronómetro en marcha

### M-03 — Operación en curso

*Cronómetro de trabajo con pausas diferenciadas.* Ruta `/m/operacion`. RF: RF-21, RF-23.

Contenido:
- Cronómetro grande de tiempo efectivo
- Botón Pausa activa (verde) y botón Descanso (azul)
- Contador de tiempo en pausa cuando aplica
- Botones Registrar producción, Registrar merma y Finalizar

Acciones:
- Pausa activa o Descanso → cronómetro detenido y contador de pausa
- Reanudar → sigue el tiempo efectivo
- Registrar producción → M-04
- Registrar merma → M-05
- Finalizar en etapa de empacado → M-06; en otra etapa → M-01

### M-04 — Registrar producción

*Ingreso de lo producido en la etapa.* Ruta `/m/produccion`. RF: RF-15.

Contenido:
- Extrusión: kg de materia prima usada y kg de rollo
- Impresión, sellado o troquelado: unidades
- Teclado numérico grande
- Botón Guardar

Acciones:
- Guardar → confirmación y regreso a M-03

### M-05 — Registrar merma

*Ingreso de desperdicio y su destino.* Ruta `/m/merma`. RF: RF-16, RF-17.

Contenido:
- Campo kg
- Opciones grandes de destino: Molido, Peletizado, Venta a recicladora
- Botón Guardar

Acciones:
- Guardar → regreso a M-03; si supera el umbral, alerta al supervisor

### M-06 — Cierre en empacado

*Conteo final de la orden.* Ruta `/m/cierre`. RF: RF-18.

Contenido:
- Cantidad pedida
- Campos conteo final y número de bultos
- Diferencia (faltan o sobran)
- Botón Cerrar orden (habilitado con ambos campos)

Acciones:
- Cerrar orden → orden Por validar → M-07

### M-07 — Resumen de turno

*Resumen personal del turno.* Ruta `/m/turno`. RF: RF-24.

Contenido:
- Tiempo efectivo, pausas activas y descansos
- Unidades o kg registrados por etapa
- Lista de operaciones del día

Acciones:
- Volver → M-01

### M-08 — Planta (supervisor)

*Vista móvil del estado de máquinas para el supervisor en planta.* Ruta `/m/planta`. RF: RF-25, RF-17.

Contenido:
- Lista de máquinas con color por estado
- Alertas de merma excedida
- Acceso a la orden en curso

Acciones:
- Tocar alerta u orden → detalle de orden (versión móvil de W-09)

## 7. Flujos que deben poder recorrerse

**Flujo 1 — Configuración inicial del catálogo** (Administradora Principal)
1. `P-01` La Administradora ingresa con su usuario.
2. `W-01` Ve el panel con sus pendientes.
3. `W-02` Crea las cuentas del personal y asigna roles.
4. `W-21` Descarga la plantilla e importa el catálogo inicial (pestaña Importar).
5. `W-03` Revisa y completa materias primas e insumos.
6. `W-04` Registra o corrige las fundas con su tipo y peso por unidad.
7. `W-05` Define la receta por kilogramo de una funda y la envía a aprobación.
8. `W-06` Aprueba la receta; queda registrada en la bitácora.

**Flujo 2 — Precios de proveedores y costos de recursos** (Responsable Contable, Encargada de RR. HH., Administradora Principal)
1. `W-11` El Responsable Contable registra el nuevo precio de una resina.
2. `W-15` El sistema muestra las fundas afectadas y su variación de costo.
3. `W-12` La Administradora compara opciones locales e importadas antes de comprar.
4. `W-13` RR. HH. actualiza el costo por hora de un cargo; la Administradora, el de una máquina.

**Flujo 3 — Del pedido a la orden de producción** (Jefe de Ventas, Supervisor de Planta)
1. `W-07` El Jefe de Ventas registra un pedido de 10.000 fundas impresas FI-4060 (12,5 g); ve 125,00 kg y 275,58 lb.
2. `W-08` El Supervisor genera la orden: extrusión, impresión, sellado y empacado; asigna máquina y operarios y la libera a planta.

**Flujo 4 — Producción en planta (app móvil)** (Operario de Producción)
1. `P-01` El operario ingresa desde el celular.
2. `M-01` Ve sus etapas asignadas y toca la de extrusión.
3. `M-02` Revisa la meta en kg y la máquina; toca Iniciar operación.
4. `M-03` Trabaja con el cronómetro en marcha; marca una pausa activa y luego reanuda.
5. `M-04` Registra kg de materia prima usada y kg de rollo.
6. `M-05` Registra la merma y su destino.
7. `M-03` Finaliza la operación. Las demás etapas se registran igual por sus operarios.
8. `M-06` En empacado, el operario ingresa conteo final y bultos y cierra la orden.
9. `M-07` Consulta el resumen de su turno.

**Flujo 5 — Supervisión y cierre** (Supervisor de Planta)
1. `W-10` El Supervisor sigue el estado de las máquinas desde la oficina.
2. `M-08` En planta, ve lo mismo en el celular y recibe la alerta si la merma supera el umbral.
3. `W-09` Revisa la orden "Por validar", corrige una marcación si hace falta y valida el cierre.

**Flujo 6 — Costeo y fijación de precio** (Administradora Principal, Jefe de Ventas, Encargada de Facturación)
1. `W-14` Al validarse la orden, el sistema muestra su costo total y unitario con el desglose.
2. `W-16` El Jefe de Ventas compara tres márgenes y propone un precio.
3. `W-17` La Administradora aprueba la propuesta (o la justifica si está bajo el mínimo).
4. `W-18` Facturación consulta el costo y el precio vigentes para usarlos en Dobra.

**Flujo 7 — Análisis e integración** (Administradora Principal, Responsable Contable)
1. `W-19` La Administradora revisa el reporte de tiempos y pausas del mes y lo descarga en Excel.
2. `W-20` Revisa la evolución del costo unitario, del precio de la resina y de las mermas.
3. `W-21` Contabilidad genera el archivo de costos y precios aprobados para Dobra (pestaña Exportar).
4. `W-22` La Administradora revisa en la bitácora quién aprobó cada cambio.

## 8. Datos de demostración (`src/data/seed.ts`)

Usuarios (contraseña `demo123`; mostrar accesos rápidos en P-01):

- `admin` — Administradora Principal (Web, inicia en W-01)
- `ventas` — Jefe de Ventas (Web, inicia en W-01)
- `contabilidad` — Responsable Contable (Web, inicia en W-01)
- `facturacion` — Encargada de Facturación (Web, inicia en W-18)
- `rrhh` — Encargada de RR. HH. (Web, inicia en W-13)
- `supervisor` — Supervisor de Planta (Web y móvil, inicia en W-10 / M-08)
- `operario1` — Operario de Producción (extrusión) (Móvil, inicia en M-01)
- `operario2` — Operario de Producción (sellado y empacado) (Móvil, inicia en M-01)

Fundas:

- `FN-2030` Funda natural 20x30 — 20 x 30 cm, calibre 1,5, 4,0 g — Natural
- `FI-4060` Funda impresa 40x60 con logo — 40 x 60 cm, calibre 2,0, 12,5 g — Impresa
- `FV-1520` Funda de vivero 15x20 — 15 x 20 cm, calibre 2,5, 6,0 g — Vivero
- `FB-2636` Funda de basura negra 26x36 (reciclada) — 26 x 36 cm, calibre 1,2, 8,0 g — Natural

Materias primas e insumos:

- `PEBD` Polietileno de baja densidad (pepitas) (kg): local 1,50 USD/kg; importado 1,40 USD/kg (35 días)
- `PEAD` Polietileno de alta densidad (pepitas) (kg): local 1,62 USD/kg; importado 1,45 USD/kg (40 días)
- `REC` Material reciclado peletizado (kg): propio 0,60 USD/kg
- `PIG-N` Pigmento negro (masterbatch) (kg): local 3,20 USD/kg
- `TINTA` Tinta flexográfica (litro): local 9,80 USD/litro

Máquinas: `EXT-01` Extrusión 8,50 USD/h; `EXT-02` Extrusión 8,50 USD/h; `IMP-01` Impresión 10,00 USD/h; `SEL-01` Sellado 5,00 USD/h; `SEL-02` Sellado 5,00 USD/h; `TRQ-01` Troquelado 4,00 USD/h.

Casos preparados: Pedido de 10.000 fundas FI-4060 (impresas) para el cliente ficticio "Comercial Ejemplo S.A.", que se convierte en 125 kg (275,58 lb); y una orden en curso de FN-2030 con merma de 3,5 % para mostrar la alerta.

Además: 6 meses de historial de costos unitarios, precios de PEBD y % de merma para que W-01 y W-20 muestren tendencias; una receta en Borrador para W-06; una propuesta de precio bajo el mínimo para W-17; tres órdenes en distintos estados. Los nombres de clientes y operarios deben ser claramente ficticios.

## 9. Capturas para el SRS

`scripts/capture.ts` debe abrir la build web con Playwright, iniciar sesión con el usuario adecuado, navegar a cada pantalla con datos cargados y guardar:

- Pantallas web: viewport 1440×900, archivo `capturas/W-XX.png`.
- Pantallas móviles: viewport 390×844 (deviceScaleFactor 2), archivo `capturas/M-XX.png`.
- Inicio de sesión: `capturas/P-01-web.png` (1440×900) y `capturas/P-01-movil.png` (390×844).

Los nombres deben coincidir exactamente: el LaTeX del SRS los busca en `capturas/` y, si existen, reemplaza los marcadores automáticamente.

## 10. Comandos

```bash
npm install
npx expo start            # desarrollo (w = web, a = Android)
npm test                  # pruebas de dominio
npx expo export -p web    # build web en dist/
npm run capture           # capturas en capturas/
```

## 11. Fuera de alcance

- Backend, base de datos real, autenticación real, envío de correos o notificaciones push.
- Facturación, contabilidad, nómina o inventario de bodega (siguen en Dobra).
- Integración real con Dobra: W-21 genera un CSV de ejemplo con columnas `codigo,nombre,costo_unitario,precio_referencial,fecha` (formato provisional hasta cerrar el spike SP-01).

## 12. Definición de terminado

- [ ] Las 31 pantallas existen y se llega a cada una desde la navegación.
- [ ] Los 7 flujos se recorren sin errores en web y en Android.
- [ ] Las pruebas de `src/domain` pasan y `costing.ts` tiene ≥ 80 % de cobertura.
- [ ] Los permisos por rol coinciden con la Tabla 5.1 del SRS.
- [ ] `npm run capture` genera todas las imágenes de la sección 9.
- [ ] README con instrucciones para correr web y Android.
