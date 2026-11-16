# CLAUDE.md — Implementación de SeguCost (web + móvil)

Instrucciones para el agente de código que construirá **SeguCost**, sistema de pedidos, producción y costeo para SEGUPLAST S.A. (fábrica de fundas plásticas, Guayaquil). Proyecto de Ingeniería de Software I, ESPOL, Equipo T4.

Fuentes de verdad, en este orden: el SRS v2.0 (`docs/srs_segucost_es.pdf`), las capturas del prototipo aprobado (`docs/capturas/`) y este archivo. Si algo aquí contradice al SRS, manda el SRS.

## 0. Cómo trabajar con este archivo

- **Referencia visual:** cada pantalla tiene su captura en `docs/capturas/<ID>.png` (`P-01-web.png`, `P-01-movil.png`, `W-01.png` … `M-08.png`). Ábrela antes de construir o modificar esa pantalla y replica su estructura, textos, orden de campos y estados. Las capturas salen del mismo diseño que está en Figma.
- **Navegación de referencia:** `docs/prototipo/segucost_prototipo.html` es el prototipo navegable (se abre en el navegador, sin servidor). Úsalo para ver a dónde lleva cada botón.
- **Figma:** el diseño original está en https://www.figma.com/design/EbAcbRQfn4OGX6TywYwF9X. Consúltalo con el MCP de Figma solo si hay una duda que la captura no resuelve: la cuenta tiene plan Starter y pocas llamadas disponibles.
- **Si el repositorio ya tiene código:** no lo reescribas. Compara cada pantalla existente con su captura, lista las diferencias y modifica solo lo necesario. Mantén el stack que ya use el repo; la sección 2 aplica solo si el repo está vacío.
- **Orden de trabajo:** tema y componentes (sección 5) → lógica de dominio con pruebas (sección 4) → pantallas por flujo (sección 7, del flujo 1 al 7) → revisión contra la definición de terminado (sección 10).
- Trabaja una pantalla o un flujo por vez y muestra el resultado antes de seguir con el siguiente.

## 1. Objetivo

- **Una sola base de código** para la **aplicación web** (oficina) y la **aplicación móvil Android** (planta).
- Cuatro roles: Administradora Principal (`adm`), Jefe de Ventas (`ven`), Supervisor de Planta (`sup`) y Operario de Producción (`ope`).
- Las pantallas deben verse como en las capturas de `docs/capturas/` (diseño de Figma, páginas Web y Móvil) y cumplir los RF de la sección 6.
- Los 7 flujos de la sección 7 deben poder recorrerse de principio a fin.

## 2. Stack (si el repo está vacío)

- **Expo** (React Native) con **TypeScript** y **Expo Router**; la web con `react-native-web`.
- Backend: API REST con JSON sobre HTTPS (RI-05). Para la primera iteración se permite un store local con **Zustand** y datos de la sección 8.
- Pruebas: **Jest** (`jest-expo`) para la lógica de dominio; **Playwright** para recorrer los flujos en la web.
- Cálculos de dinero con aritmética decimal exacta (por ejemplo `decimal.js`), nunca con `number` (RNF-13).

## 3. Estructura sugerida

```
app/
  login.tsx                 # P-01
  (web)/_layout.tsx         # menú lateral filtrado por rol + encabezado con ruta y usuario
  (web)/...                 # W-01 a W-21 (W-10b y W-13b son diálogos, W-20b es una pestaña)
  (movil)/_layout.tsx       # barra superior azul, acción principal fija abajo
  (movil)/...               # M-01 a M-08
src/domain/                 # lógica pura con pruebas (sección 4)
src/data/seed.ts            # datos de demostración (sección 8)
src/components/             # Button, Field, StatusTag, Card, DataTable, Steps, Kpi, Chart, Dialog
src/theme.ts                # tokens de color y tipografía (sección 5)
docs/                       # SRS, historias y flujo del prototipo
```

## 4. Lógica de dominio (con pruebas)

Funciones puras en `src/domain/`, con cobertura mínima de 80 % en el costeo (RNF-23). Los casos salen de los criterios de aceptación del SRS:

| Función | Regla | Caso de prueba |
|---|---|---|
| `unitsToWeight` (RF-14) | kg = unidades × peso_calibrado_g / 1000; lb = kg × 2.20462 | 10 000 × 12,5 g → 125,00 kg / 275,58 lb |
| `buildStages` (RF-28) | extrusión; + impresión si tiene impresión; sellado; + troquelado si tiene perforación; empacado | impresa + vivero → [EXT, IMP, SEL, TRQ, EMP] |
| `priceOnCost` (RF-17) | precio = costo_unitario × (1 + %) | 0,0371 al 25 % → 0,0464 |
| `isException` (RF-18) | % < ganancia mínima vigente | 15 % con mínimo 20 % → true |
| `canChangeOrder` (RF-21) | ninguna orden del pedido tiene registros de producción | con un registro → false |
| `canCancelLine` (RF-22) | estándar: sí; exclusiva: solo si no inició | exclusiva iniciada → false |
| `effectiveTime` (RF-34) | fin − inicio − pausas activas − descansos | 07:05–12:20 con 10 + 15 min → 4 h 50 min |
| `validateIntervals` (RF-35) | sin duraciones negativas, pausas dentro del intervalo, sin solapes del mismo operario | fin < inicio → error |
| `materialBalance` (RF-33) | dif = entradas − (conforme + en proceso + mermas); pide justificación si dif% > tolerancia | 128,6 vs 127,8 → 0,8 kg (0,6 %) → justificar |
| `estimatedCost` (RF-45) | materiales (peso × fórmula × precio ref.) + MO + máquina + indirectos; material del cliente = 0 | FI-4060 10 000 u → 371,43 USD |
| `estimatedHours` (RF-25) | horas de una etapa = kg a procesar / rendimiento de la máquina (kg/h) | 125 kg en una máquina de 25 kg/h → 5 h |
| `actualCost` (RF-46) | CT = materiales + MO + máquina + indirectos − recuperado; CU = CT / conformes | OP-0139 → 519,01 USD; 0,0104 USD |
| `deviation` (RF-47) | real − estimado; ganancia = precio − real; % sobre el costo real | 519,01 − 505,20 = +13,81 (+2,7 %) |
| `canTransition` (RF-40) | Planificada→Liberada→En proceso→Por validar→Cerrada; Por validar→En proceso; Planificada/Liberada→Anulada | Cerrada→En proceso → false |
| `can(role, feature)` (RF-04) | matriz de permisos del SRS | `ope` no ve montos |

Redondeo: totales a 2 decimales y unitarios a 4. Formato `es-EC` (coma decimal).

## 5. Reglas de interfaz (copiar de Figma)

- Tipografía Inter. Colores: azul `#002855` (primario), `#123F73` (selección del menú), dorado `#F2A900` (marca), fondo `#F5F7FA`, superficie `#EEF1F6`, borde `#DDE3EA`, texto `#1A2433`, texto secundario `#5B6676`, éxito `#1B7F3B`, error `#B3261E`, alerta `#8A5A00` sobre `#FFF2CC`, información `#1F5FA8`.
- Estados siempre con color **y** texto (RNF-19). Pausa activa = verde; descanso = azul, en móvil y en reportes.
- Una acción principal por pantalla; tablas cortas; tarjetas con 24 px de relleno.
- Web desde 1280 px (RNF-17): menú lateral de 248 px filtrado por rol (RI-01), encabezado de 64 px con ruta de navegación.
- Móvil: controles de 48 dp o más, texto de 16 sp o más, acción principal fija abajo, teclado numérico en cantidades y horas (RNF-02, RI-02).
- Errores junto al campo con la forma de corregirlos (RNF-04); acciones irreversibles con diálogo que explica el efecto (RNF-05).
- Sin conexión, la app guarda los registros, lo indica y sincroniza sin duplicar (RNF-11).

## 6. Pantallas

| ID | Pantalla | Plataforma | Roles | RF |
|---|---|---|---|---|
| P-01 | Inicio de sesión | Web y móvil | Todos los roles | RF-01, RF-02 |
| W-01 | Panel principal | Web | Administradora Principal, Jefe de Ventas, Supervisor de Planta | RF-04, RF-37 |
| W-02 | Usuarios y roles | Web | Administradora Principal | RF-03, RF-04, RF-05 |
| W-03 | Materias primas e insumos | Web | Administradora Principal | RF-06 |
| W-04 | Productos y fichas técnicas | Web | Supervisor de Planta, Administradora Principal, Jefe de Ventas | RF-07, RF-08 |
| W-05 | Fórmulas de fabricación | Web | Supervisor de Planta | RF-09 |
| W-06 | Productos nuevos | Web | Jefe de Ventas, Supervisor de Planta | RF-10, RF-11 |
| W-07 | Solicitudes comerciales | Web | Jefe de Ventas | RF-12, RF-13, RF-14, RF-15, RF-24 |
| W-08 | Cotización y simulación | Web | Jefe de Ventas | RF-16, RF-17, RF-18, RF-45 |
| W-09 | Excepciones comerciales | Web | Administradora Principal | RF-19 |
| W-10 | Pedidos confirmados | Web | Jefe de Ventas | RF-20, RF-21, RF-22, RF-23 |
| W-10b | Cancelación de línea (diálogo) | Web | Jefe de Ventas | RF-22 |
| W-11 | Planificación de orden | Web | Supervisor de Planta | RF-26, RF-27, RF-28, RF-29 |
| W-12 | Seguimiento de producción | Web | Supervisor de Planta, Administradora Principal | RF-37, RF-40 |
| W-13 | Detalle y cierre de orden | Web | Supervisor de Planta | RF-33, RF-36, RF-38, RF-39 |
| W-13b | Confirmar cierre (diálogo) | Web | Supervisor de Planta | RF-38, RF-39 |
| W-14 | Parámetros de costeo | Web | Administradora Principal | RF-25, RF-41 |
| W-15 | Precios de materias primas | Web | Administradora Principal | RF-42, RF-43, RF-44 |
| W-16 | Costo real de orden | Web | Administradora Principal | RF-46 |
| W-17 | Rentabilidad y desviaciones | Web | Administradora Principal | RF-47 |
| W-18 | Indicadores productivos | Web | Supervisor de Planta, Administradora Principal | RF-48 |
| W-19 | Reportes económicos | Web | Administradora Principal | RF-49 |
| W-20 | Importar datos (CSV) | Web | Administradora Principal | RF-50 |
| W-20b | Exportar datos (CSV) | Web | Administradora Principal | RF-51 |
| W-21 | Bitácora | Web | Administradora Principal | RF-05 |
| M-01 | Mis actividades | Móvil | Operario de Producción | RF-30, RF-04 |
| M-02 | Detalle de etapa | Móvil | Operario de Producción | RF-30 |
| M-03 | Registrar tiempos y pausas | Móvil | Operario de Producción | RF-34, RF-35 |
| M-04 | Registrar producción y consumos | Móvil | Operario de Producción | RF-31 |
| M-05 | Registrar merma | Móvil | Operario de Producción | RF-32 |
| M-06 | Revisar y enviar | Móvil | Operario de Producción | RF-33 |
| M-07 | Mi turno | Móvil | Operario de Producción | RF-34, RF-36 |
| M-08 | Seguimiento (Supervisor) | Móvil | Supervisor de Planta | RF-37 |

### P-01 — Inicio de sesión

*Entrada única a SeguCost. Según el rol, lleva al panel web o a la aplicación móvil.* RF: RF-01, RF-02.

Contenido:
- Nombre del sistema y de la empresa
- Campos Usuario y Contraseña con etiqueta visible
- Opción Mostrar contraseña
- Botón Ingresar
- Mensaje de error genérico (versión móvil)

Acciones:
- Ingresar como operario → M-01 Mis actividades
- Ingresar con otro rol → W-01 Panel principal
- Credenciales erróneas → "Usuario o contraseña incorrectos"

### W-01 — Panel principal

*Inicio de cada rol de oficina: lo que requiere su atención hoy.* RF: RF-04, RF-37.

Contenido:
- Menú lateral filtrado por rol y agrupado por proceso
- Cuatro indicadores: solicitudes por cotizar, excepciones por autorizar, órdenes en proceso, órdenes por validar
- Lista corta de tareas pendientes con acceso directo
- Aviso de merma sobre el umbral

Acciones:
- Clic en un indicador o tarea → pantalla del módulo

### W-02 — Usuarios y roles

*Administración de cuentas con los cuatro roles de negocio.* RF: RF-03, RF-04, RF-05.

Contenido:
- Tabla de cuentas (nombre, usuario, rol, estado)
- Panel lateral Nueva cuenta con validación en el campo
- Rol elegido de una lista cerrada

Acciones:
- Guardar → cuenta en la tabla
- Usuario repetido → error junto al campo con sugerencia
- Desactivar → estado Inactivo (no se borra)

### W-03 — Materias primas e insumos

*Catálogo de insumos usados en fórmulas y precios.* RF: RF-06.

Contenido:
- Buscador y filtro por categoría
- Tabla con código, nombre, categoría, unidad y estado
- Panel de edición con código bloqueado y aviso de uso en fórmulas

Acciones:
- Guardar → insumo actualizado
- Desactivar → deja de ofrecerse en fórmulas nuevas

### W-04 — Productos y fichas técnicas

*Ficha técnica de cada funda con versión.* RF: RF-07, RF-08.

Contenido:
- Tabla de productos con tipo (estándar o exclusivo)
- Ficha: ancho, largo, calibre, material, impresión, peso calibrado
- Características combinables (impresión, perforación de vivero, fuelle)
- Vista previa de la ruta de etapas
- Historial de versiones

Acciones:
- Marcar perforación → la ruta agrega Troquelado
- Guardar cambio relevante → versión nueva
- Ver fórmula → W-05

### W-05 — Fórmulas de fabricación

*Fórmula por kilogramo con versiones; el Supervisor habilita la vigente.* RF: RF-09.

Contenido:
- Encabezado con producto y versión habilitada
- Tabla editable: insumo, cantidad por kg, unidad
- Total por kg que debe sumar 1,000
- Historial de versiones

Acciones:
- Agregar insumo → nueva fila
- Habilitar versión → la anterior queda en historial

### W-06 — Productos nuevos

*Solicitud de Ventas y evaluación técnica del Supervisor en una misma bandeja.* RF: RF-10, RF-11.

Contenido:
- Lista de solicitudes con estado
- Detalle: cliente, uso previsto, características pedidas
- Bloque de evaluación: decisión y observaciones
- Botones Aprobar y crear ficha / Rechazar

Acciones:
- Rechazar sin observación → error
- Aprobar → abre la ficha técnica en W-04

### W-07 — Solicitudes comerciales

*Registro de solicitudes con varias líneas, canal de origen, urgencia y entregas programadas.* RF: RF-12, RF-13, RF-14, RF-15, RF-24.

Contenido:
- Lista de solicitudes con estado y canal
- Formulario: cliente, canal, prioridad
- Líneas: producto, cantidad, peso en kg y lb, entregas
- Casilla Material del cliente con cantidades recibidas

Acciones:
- Agregar línea → nueva fila
- Generar cotización → W-08

### W-08 — Cotización y simulación

*Costo estimado por línea y precio con porcentaje de ganancia sobre el costo.* RF: RF-16, RF-17, RF-18, RF-45.

Contenido:
- Resumen de la cotización y revisión
- Por línea: costo estimado (materiales, transformación), unitario
- Tres opciones de porcentaje con su precio
- Marca de excepción si queda bajo el mínimo
- Botones Enviar a autorización / Confirmar pedido

Acciones:
- Elegir opción → precio de la línea
- Línea en excepción → Confirmar deshabilitado, Enviar a autorización → W-09

### W-09 — Excepciones comerciales

*Bandeja de cotizaciones con ganancia bajo el mínimo.* RF: RF-19.

Contenido:
- Lista de excepciones pendientes
- Detalle: costo, porcentaje propuesto, mínimo, diferencia
- Observación (obligatoria al rechazar)
- Botones Rechazar / Autorizar

Acciones:
- Autorizar → la cotización puede confirmarse (W-10)

### W-10 — Pedidos confirmados

*Seguimiento de cantidades y entregas; cambios y cancelaciones según las reglas de la empresa.* RF: RF-20, RF-21, RF-22, RF-23.

Contenido:
- Encabezado del pedido y origen (cotización)
- Por línea: comprometido, producido, entregado, pendiente
- Entregas parciales programadas
- Etiqueta Exclusivo/Estándar y candado si ya inició en planta

Acciones:
- Registrar entrega → pendiente baja
- Cancelar línea exclusiva iniciada → no permitido (W-10b)

### W-10b — Cancelación de línea (diálogo)

*Diálogo que explica las consecuencias de cancelar según el tipo de producto.* RF: RF-22.

Contenido:
- Diálogo modal con el motivo de la restricción
- Alternativa: cancelar solo la línea estándar

Acciones:
- Cerrar → vuelve a W-10

### W-11 — Planificación de orden

*Orden generada desde una línea confirmada con etapas y recursos propuestos.* RF: RF-26, RF-27, RF-28, RF-29.

Contenido:
- Datos de la línea y peso teórico
- Versiones de ficha y fórmula usadas
- Etapas numeradas
- Por etapa: máquina propuesta (solo de su sección) y operario

Acciones:
- Falta operario → Liberar deshabilitado
- Liberar a planta → orden visible en M-01

### W-12 — Seguimiento de producción

*Avance de órdenes según los últimos registros (no es monitoreo de máquinas).* RF: RF-37, RF-40.

Contenido:
- Filtros por estado
- Tarjetas de orden con etapas, avance y último registro
- Alertas de merma o balance

Acciones:
- Clic en orden por validar → W-13

### W-13 — Detalle y cierre de orden

*Validación de etapas, balance de materiales y tiempos antes de cerrar.* RF: RF-33, RF-36, RF-38, RF-39.

Contenido:
- Etapas completas
- Balance de materiales con diferencia y justificación
- Registros de tiempo con opción Corregir (con motivo)
- Botones Devolver con observación / Cerrar orden

Acciones:
- Cerrar orden → diálogo de confirmación (W-13b)

### W-13b — Confirmar cierre (diálogo)

*Confirmación con el efecto del cierre.* RF: RF-38, RF-39.

Contenido:
- Resumen: unidades conformes, merma, material recuperado
- Aviso: la orden quedará bloqueada y se calculará el costo real

Acciones:
- Cerrar orden → W-16 Costo real

### W-14 — Parámetros de costeo

*Tarifas con vigencia y reglas comerciales.* RF: RF-25, RF-41.

Contenido:
- Pestañas: Mano de obra, Máquinas, Indirectos, Reglas
- Tabla de tarifas con vigencia
- Regla: ganancia mínima sobre el costo, umbral de merma, tolerancia del balance

Acciones:
- Guardar → valor vigente y anterior en historial

### W-15 — Precios de materias primas

*Referencias de precio por proveedor llevadas a USD/kg y lo que incluyen.* RF: RF-42, RF-43, RF-44.

Contenido:
- Selector de materia prima
- Tabla: proveedor, origen, precio USD/kg, incluye, plazo, diferencia
- Precio de referencia marcado
- Historial del precio

Acciones:
- Usar como referencia → precio para estimaciones nuevas

### W-16 — Costo real de orden

*Costo real calculado al cerrar la orden, con su base de cálculo.* RF: RF-46.

Contenido:
- Seis tarjetas: materiales, mano de obra, máquina, indirectos, recuperado, total y unitario
- Fórmula con los valores reales
- Tabla de detalle por componente

Acciones:
- Ver rentabilidad → W-17

### W-17 — Rentabilidad y desviaciones

*Estimado frente a real y ganancia por orden.* RF: RF-47.

Contenido:
- Filtros: período, producto
- Tabla: orden, estimado, real, desviación, precio, ganancia, estado (cerrado/proyectado)
- Gráfico de barras estimado vs real

Acciones:
- Clic en orden → W-16

### W-18 — Indicadores productivos

*Tiempos, pausas, cantidades y mermas por período.* RF: RF-48.

Contenido:
- Filtros: período, orden, etapa
- Indicadores: tiempo productivo, pausas activas, descansos, merma
- Gráfico de barras apiladas por operario
- Fecha de última actualización

Acciones:
- Cambiar período → se actualizan tabla y gráfico

### W-19 — Reportes económicos

*Histórico de costo y rentabilidad por producto.* RF: RF-49.

Contenido:
- Filtros
- Gráfico de costo unitario por mes
- Tabla por producto
- Descargar Excel / PDF

Acciones:
- Descargar → archivo con los mismos filtros

### W-20 — Importar datos (CSV)

*Carga inicial de clientes, insumos y productos con validación previa.* RF: RF-50.

Contenido:
- Pestañas Importar / Exportar
- Paso a paso: 1 descargar plantilla, 2 subir archivo, 3 revisar
- Resumen: filas válidas y filas con error con su motivo

Acciones:
- Archivo con errores → no se importa nada hasta corregir

### W-20b — Exportar datos (CSV)

*Exportación de costos y precios aprobados para compartir con Dobra.* RF: RF-51.

Contenido:
- Selección de productos con precio aprobado
- Vista previa del archivo
- Historial de exportaciones con responsable

Acciones:
- Generar archivo → descarga y registro en historial

### W-21 — Bitácora

*Consulta de cambios con valor anterior y nuevo.* RF: RF-05.

Contenido:
- Filtros por usuario, entidad y fecha
- Tabla: fecha, usuario, entidad, acción, antes, después
- Aviso de solo lectura

Acciones:
- Solo consulta

### M-01 — Mis actividades

*Etapas asignadas al operario, separadas en pendientes, activas y concluidas.* RF: RF-30, RF-04.

Contenido:
- Saludo con nombre y turno
- Estado de conexión
- Pestañas Pendientes / Concluidas
- Tarjetas grandes: orden, producto, meta, máquina, entrega

Acciones:
- Tocar tarjeta → M-02
- Mi turno → M-07

### M-02 — Detalle de etapa

*Especificación de la etapa antes de trabajar.* RF: RF-30.

Contenido:
- Producto, medidas, calibre, material
- Meta de la etapa
- Máquina asignada
- Materiales según la fórmula
- Pasos de registro (tiempos, producción, merma)

Acciones:
- Registrar tiempos → M-03

### M-03 — Registrar tiempos y pausas

*Registro al terminar la actividad: inicio, fin y pausas.* RF: RF-34, RF-35.

Contenido:
- Inicio y fin con teclado de hora
- Lista de pausas con tipo (pausa activa verde, descanso azul)
- Tiempo efectivo calculado
- Botón Continuar

Acciones:
- Agregar pausa → nueva fila
- Continuar → M-04

### M-04 — Registrar producción y consumos

*Cantidad conforme y consumo real de cada insumo.* RF: RF-31.

Contenido:
- Rollo conforme (kg)
- Consumos por insumo con la cantidad de la fórmula como referencia
- Botón Continuar

Acciones:
- Continuar → M-05

### M-05 — Registrar merma

*Merma recuperable con destino y merma no recuperable.* RF: RF-32.

Contenido:
- Kg recuperables
- Destino: Molido, Peletizado, Venta a recicladora (opciones grandes)
- Kg no recuperables
- Porcentaje de merma calculado

Acciones:
- Continuar → M-06

### M-06 — Revisar y enviar

*Resumen del registro con el balance de materiales.* RF: RF-33.

Contenido:
- Resumen de tiempos, producción y merma
- Balance: entradas, salidas y diferencia
- Justificación si la diferencia supera la tolerancia
- Botón Enviar registro

Acciones:
- Enviar → M-07 con confirmación

### M-07 — Mi turno

*Resumen personal del turno y correcciones hechas por el Supervisor.* RF: RF-34, RF-36.

Contenido:
- Confirmación del envío
- Tiempo efectivo, pausas activas y descansos
- Registros del día
- Aviso de corrección del Supervisor

Acciones:
- Volver → M-01

### M-08 — Seguimiento (Supervisor)

*Vista móvil del seguimiento para el Supervisor en planta.* RF: RF-37.

Contenido:
- Alerta de balance o merma
- Órdenes con avance y último registro

Acciones:
- Tocar orden → W-13 (en la oficina)

## 7. Flujos que deben poder recorrerse

**Flujo 1 — Configuración inicial** (Administradora Principal)
1. `P-01` La Administradora ingresa con su usuario.
2. `W-01` Ve el panel con sus pendientes.
3. `W-02` Crea las cuentas del personal con uno de los cuatro roles.
4. `W-20` Descarga la plantilla CSV e importa clientes, insumos y productos.
5. `W-03` Revisa y completa las materias primas e insumos.
6. `W-14` Registra tarifas de mano de obra, máquinas, indirectos y la ganancia mínima.
7. `W-15` Registra los precios de proveedores y elige el de referencia.

**Flujo 2 — Producto nuevo y ficha técnica** (Jefe de Ventas, Supervisor de Planta)
1. `W-06` Ventas registra la solicitud de un producto nuevo; el Supervisor la evalúa y la aprueba.
2. `W-04` El Supervisor completa la ficha técnica con el peso calibrado y las características.
3. `W-05` Registra la fórmula por kilogramo y habilita la versión.

**Flujo 3 — De la solicitud al pedido confirmado** (Jefe de Ventas, Administradora Principal)
1. `W-07` El Jefe de Ventas registra la solicitud de Comercial Ejemplo S.A. (WhatsApp) con dos líneas.
2. `W-08` Revisa el costo estimado, simula porcentajes y envía la línea bajo el mínimo a autorización.
3. `W-09` La Administradora autoriza la excepción.
4. `W-10` El cliente acepta y queda el pedido confirmado con entregas programadas.
5. `W-10b` Si intenta cancelar una línea exclusiva ya iniciada, el sistema lo impide y explica por qué.

**Flujo 4 — Planificación de la producción** (Supervisor de Planta)
1. `W-11` El Supervisor genera la orden, revisa etapas y recursos propuestos y la libera a planta.
2. `W-12` La orden aparece en el seguimiento.

**Flujo 5 — Registro en planta (aplicación móvil)** (Operario de Producción)
1. `P-01` El operario ingresa desde el celular.
2. `M-01` Ve sus actividades y toca la etapa de extrusión.
3. `M-02` Revisa la especificación y trabaja en la máquina.
4. `M-03` Al terminar, registra inicio, fin y pausas.
5. `M-04` Registra el rollo conforme y los consumos.
6. `M-05` Registra la merma y su destino.
7. `M-06` Revisa el balance, justifica la diferencia y envía.
8. `M-07` Consulta el resumen de su turno.

**Flujo 6 — Supervisión y cierre** (Supervisor de Planta)
1. `M-08` En planta, el Supervisor ve la alerta de balance.
2. `W-12` En la oficina revisa el seguimiento y abre la orden por validar.
3. `W-13` Revisa etapas, balance y tiempos; corrige una marcación con motivo.
4. `W-13b` Confirma el cierre; la orden se bloquea.

**Flujo 7 — Costeo, rentabilidad y reportes** (Administradora Principal, Supervisor de Planta)
1. `W-16` La Administradora revisa el costo real de la orden cerrada.
2. `W-17` Compara estimado, real y precio acordado.
3. `W-18` El Supervisor revisa los indicadores de tiempos y mermas.
4. `W-19` La Administradora revisa el histórico económico.
5. `W-20b` Exporta en CSV los costos y precios aprobados.
6. `W-21` Revisa en la bitácora quién hizo cada cambio.

## 8. Datos de demostración (`src/data/seed.ts`)

Usuarios (contraseña `demo123`):

- `admin` — Administradora Principal (Web, inicia en W-01)
- `ventas` — Jefe de Ventas (Web, inicia en W-01)
- `supervisor` — Supervisor de Planta (Web y móvil, inicia en W-01 / M-08)
- `operario1` — Operario de Producción (extrusión) (Móvil, inicia en M-01)
- `operario2` — Operario de Producción (sellado y empacado) (Móvil, inicia en M-01)

Productos:

- `FN-2030` Funda natural 20x30 — 20 x 30 cm, calibre 1,5, PEBD, sin impresión, 4,0 g — Estándar
- `FI-4060` Funda impresa 40x60 con logo — 40 x 60 cm, calibre 2,0, PEBD/PEAD, impresa, 12,5 g — Exclusiva del cliente
- `FV-1520` Funda de vivero 15x20 — 15 x 20 cm, calibre 2,5, PEBD, perforada, 6,0 g — Estándar
- `FB-2636` Funda de basura negra 26x36 — 26 x 36 cm, calibre 1,2, reciclado + pigmento, 8,0 g — Estándar

Materias primas e insumos:

- `PEBD` Polietileno de baja densidad (pepitas) (kg): local 1,58 USD/kg (incluye transporte); importado 1,40 USD/kg (incluye flete, 35 días)
- `PEAD` Polietileno de alta densidad (pepitas) (kg): local 1,62 USD/kg; importado 1,45 USD/kg (40 días)
- `REC` Material reciclado peletizado (kg): propio 0,60 USD/kg
- `PIG-N` Pigmento negro (masterbatch) (kg): local 3,20 USD/kg
- `TINTA` Tinta flexográfica (litro): local 9,80 USD/litro

Máquinas: `EXT-01` Extrusión 8,50 USD/h; `EXT-02` Extrusión 8,50 USD/h; `IMP-01` Impresión 10,00 USD/h; `SEL-01` Sellado 5,00 USD/h; `SEL-02` Sellado 5,00 USD/h; `TRQ-01` Troquelado 4,00 USD/h.

Tarifas y reglas: Mano de obra: extrusión 3,10; impresión 3,25; sellado 2,95; empacado 2,80 USD/h. Indirectos (servicios básicos y gastos de planta): 2,40 USD por hora productiva. Ganancia mínima: 20 % sobre el costo. Umbral de merma: 3,0 %. Tolerancia del balance: 0,5 %.

Casos preparados: Solicitud SOL-0102 de Comercial Ejemplo S.A. por WhatsApp con dos líneas: 10.000 fundas FI-4060 (125,00 kg; costo estimado 371,43 USD; 25 % → 0,0464 USD por funda) y 50.000 fundas FN-2030 en dos entregas de 25.000 (200,00 kg; costo estimado 517,15 USD; 15 % bajo el mínimo → excepción). Orden OP-0139 (FN-2030) por validar y luego cerrada con costo real 519,01 USD (0,0104 USD por funda) frente a 505,20 USD estimados. Registro móvil de OP-0142: 07:05 a 12:20, pausa activa de 10 min y descanso de 15 min (4 h 50 min efectivas); entradas 128,6 kg, salidas 127,8 kg, diferencia 0,8 kg.

## 9. Fuera de alcance

- Facturación electrónica, contabilidad, nómina, compras e inventario de bodega (siguen en Dobra).
- Integración directa con Dobra: solo CSV propio (`codigo,producto,costo_unitario,precio,cotizacion,fecha`) hasta cerrar el spike SP-01.
- Lectura automática de máquinas: el seguimiento muestra lo que registran las personas.

## 10. Definición de terminado

- [ ] Las 33 pantallas existen, coinciden con su captura en `docs/capturas/` y se llega a cada una desde la navegación.
- [ ] Los 7 flujos se recorren sin errores en web y en Android.
- [ ] Las pruebas de `src/domain` pasan y el costeo tiene cobertura de 80 % o más.
- [ ] Los permisos por rol coinciden con la matriz del SRS.
- [ ] README con instrucciones para correr web y Android.
