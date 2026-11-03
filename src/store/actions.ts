// Business operations of the prototype. Each one validates its input, updates the shared store and,
// when the SRS asks for it, writes the audit log (RF-04). Screens call these and show the result (RNF-04).
import { computeOrderCost, currentRecipe, standardCost } from '@/domain/costing';
import { buildExportCsv, validateCatalogImport, type ImportResult } from '@/domain/dobra';
import { stageCodes } from '@/domain/labels';
import { dateKey, referencePrice } from '@/domain/prices';
import { belowMinimum, currentReferencePrice } from '@/domain/pricing';
import { canTransition, orderWaste, openPause } from '@/domain/production';
import { buildRoute, sectionOf } from '@/domain/routing';
import { unitsToWeight } from '@/domain/conversion';
import { check, fail, isPositive, ok, type Result } from '@/domain/validation';
import { formatMoney, formatNumber, formatPercent, formatTime, formatUnitCost } from '@/format';
import type {
  Database,
  MarginMethod,
  MaterialType,
  MaterialUnit,
  OrderCost,
  PauseType,
  ProductType,
  RecipeItem,
  Role,
  Settings,
  StageType,
  WasteDestination,
} from '@/domain/types';
import { newId, useDataStore } from './data';
import { useSessionStore } from './session';
import { useUiStore } from './ui';

const db = () => useDataStore.getState().db;
const update = (recipe: (d: Database) => Partial<Database>) => useDataStore.getState().update(recipe);
const me = () => useSessionStore.getState().userId ?? 'u-admin';
const nowIso = () => new Date().toISOString();
const today = () => dateKey(nowIso()); // local date, not UTC
const audit = (entity: string, entityId: string, action: string, before?: string, after?: string) =>
  useDataStore.getState().audit({ userId: me(), entity, entityId, action, before, after });
const nextCode = (prefix: string, codes: string[]) => {
  const max = codes.reduce((m, c) => Math.max(m, Number(c.replace(/\D/g, '')) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
};
const productCode = (productId: string) => db().products.find((p) => p.id === productId)?.code ?? productId;
const orderCode = (orderId: string) => db().orders.find((o) => o.id === orderId)?.code ?? orderId;

// ---------------- users (RF-02) ----------------

export function saveUser(input: { id?: string; name: string; username: string; role: Role; active: boolean }): Result<string> {
  const username = input.username.trim().toLowerCase();
  const errors = check([
    ['name', !input.name.trim(), 'Ingrese los nombres'],
    ['username', !username, 'Ingrese el nombre de usuario'],
    ['username', !/^[a-z0-9._-]+$/.test(username), 'Use solo letras minúsculas, números, punto o guion'],
    ['username', db().users.some((u) => u.username === username && u.id !== input.id), 'Ese nombre de usuario ya existe'],
  ]);
  if (errors) return fail(errors);
  const id = input.id ?? newId('u');
  const existing = db().users.find((u) => u.id === id);
  update((d) => ({
    users: existing
      ? d.users.map((u) => (u.id === id ? { ...u, name: input.name.trim(), username, role: input.role, active: input.active } : u))
      : [...d.users, { id, name: input.name.trim(), username, password: 'demo123', role: input.role, active: input.active }],
  }));
  audit('Usuario', id, existing ? 'Modificación' : 'Creación', existing ? `${existing.username} (${existing.role})` : undefined, `${username} (${input.role})`);
  return ok(id);
}

export function setUserActive(id: string, active: boolean) {
  update((d) => ({ users: d.users.map((u) => (u.id === id ? { ...u, active } : u)) }));
  audit('Usuario', id, active ? 'Reactivación' : 'Desactivación', active ? 'Inactivo' : 'Activo', active ? 'Activo' : 'Inactivo');
}

// ---------------- catalog (RF-05, RF-06) ----------------

export function saveMaterial(input: { id?: string; code: string; name: string; type?: MaterialType; unit?: MaterialUnit }): Result<string> {
  const name = input.name.trim();
  const code = input.code.trim().toUpperCase();
  const errors = check([
    ['code', !code, 'Ingrese el código'],
    ['code', db().materials.some((m) => m.code === code && m.id !== input.id), 'Ese código ya existe'],
    ['name', !name, 'Ingrese el nombre'],
    ['name', db().materials.some((m) => m.name.toLowerCase() === name.toLowerCase() && m.id !== input.id), 'Ya existe un insumo con ese nombre'],
    ['type', !input.type, 'Seleccione el tipo'],
    ['unit', !input.unit, 'Seleccione la unidad'],
  ]);
  if (errors) return fail(errors);
  const id = input.id ?? newId('m');
  update((d) => ({
    materials: input.id
      ? d.materials.map((m) => (m.id === id ? { ...m, code, name, type: input.type!, unit: input.unit! } : m))
      : [...d.materials, { id, code, name, type: input.type!, unit: input.unit!, active: true }],
  }));
  return ok(id);
}

export function setMaterialActive(id: string, active: boolean) {
  update((d) => ({ materials: d.materials.map((m) => (m.id === id ? { ...m, active } : m)) }));
}

export function saveProduct(input: {
  id?: string;
  code: string;
  name: string;
  widthCm: number;
  lengthCm: number;
  gauge: number;
  weightG: number;
  type?: ProductType;
  lineId?: string;
}): Result<string> {
  const code = input.code.trim().toUpperCase();
  const errors = check([
    ['code', !code, 'Ingrese el código'],
    ['code', db().products.some((p) => p.code === code && p.id !== input.id), 'Ese código ya existe'],
    ['name', !input.name.trim(), 'Ingrese el nombre'],
    ['widthCm', !isPositive(input.widthCm), 'Debe ser mayor que cero'],
    ['lengthCm', !isPositive(input.lengthCm), 'Debe ser mayor que cero'],
    ['gauge', !isPositive(input.gauge), 'Debe ser mayor que cero'],
    ['weightG', !isPositive(input.weightG), 'El peso por unidad debe ser mayor que cero'],
    ['type', !input.type, 'Seleccione el tipo'],
    ['lineId', !input.lineId, 'Seleccione la línea'],
  ]);
  if (errors) return fail(errors);
  const id = input.id ?? newId('p');
  const data = { code, name: input.name.trim(), widthCm: input.widthCm, lengthCm: input.lengthCm, gauge: input.gauge, weightG: input.weightG, type: input.type!, lineId: input.lineId! };
  update((d) => ({
    products: input.id ? d.products.map((p) => (p.id === id ? { ...p, ...data } : p)) : [...d.products, { id, ...data, active: true }],
  }));
  return ok(id);
}

// ---------------- recipes (RF-07, RF-08) ----------------

/** Saves the product's draft; editing an approved recipe creates the next version (RF-07). */
export function saveRecipeDraft(productId: string, items: RecipeItem[]): Result<string> {
  const materialIds = items.map((i) => i.materialId);
  const errors = check([
    ['items', items.length === 0, 'Agregue al menos un insumo'],
    ['items', items.some((i) => !i.materialId), 'Seleccione el insumo de cada fila'],
    ['items', items.some((i) => !isPositive(i.qtyPerKg)), 'Las cantidades deben ser mayores que cero'],
    ['items', new Set(materialIds).size !== materialIds.length, 'Un insumo aparece dos veces'],
  ]);
  if (errors) return fail(errors);
  const recipes = db().recipes.filter((r) => r.productId === productId);
  const draft = recipes.find((r) => r.status === 'draft');
  const version = draft?.version ?? Math.max(0, ...recipes.map((r) => r.version)) + 1;
  const id = draft?.id ?? newId('r');
  update((d) => ({
    recipes: draft
      ? d.recipes.map((r) => (r.id === id ? { ...r, items, createdAt: nowIso(), createdBy: me() } : r))
      : [...d.recipes, { id, productId, version, status: 'draft', items, createdBy: me(), createdAt: nowIso() }],
  }));
  audit('Receta', id, draft ? 'Modificación' : 'Creación', undefined, `${productCode(productId)} v${version} Borrador`);
  return ok(id);
}

export function approveRecipe(id: string) {
  const recipe = db().recipes.find((r) => r.id === id)!;
  update((d) => ({ recipes: d.recipes.map((r) => (r.id === id ? { ...r, status: 'approved', decidedBy: me(), decidedAt: nowIso() } : r)) }));
  audit('Receta', id, 'Aprobación', 'Borrador', `${productCode(recipe.productId)} v${recipe.version} Aprobada`);
}

export function rejectRecipe(id: string, reason: string): Result {
  if (!reason.trim()) return fail({ reason: 'Ingrese el motivo del rechazo' });
  const recipe = db().recipes.find((r) => r.id === id)!;
  update((d) => ({ recipes: d.recipes.map((r) => (r.id === id ? { ...r, status: 'rejected', decidedBy: me(), decidedAt: nowIso(), rejectionReason: reason.trim() } : r)) }));
  audit('Receta', id, 'Rechazo', 'Borrador', `${productCode(recipe.productId)} v${recipe.version} Rechazada: ${reason.trim()}`);
  return ok(undefined);
}

// ---------------- sales orders (RF-09, RF-10, RF-13) ----------------

export function saveSalesOrder(input: {
  customerId?: string;
  productId?: string;
  quantity: number;
  dueDate: string; // YYYY-MM-DD
  isService: boolean;
  receivedMaterialKg?: number;
}): Result<string> {
  const product = db().products.find((p) => p.id === input.productId);
  const errors = check([
    ['customerId', !input.customerId, 'Seleccione el cliente'],
    ['productId', !input.productId, 'Seleccione la funda'],
    ['productId', !!product && !isPositive(product.weightG), 'La funda no tiene peso por unidad; corrija el catálogo'],
    ['quantity', !isPositive(input.quantity) || !Number.isInteger(input.quantity), 'Ingrese una cantidad entera mayor que cero'],
    ['dueDate', !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate), 'Ingrese la fecha como dd/mm/aaaa'],
    ['dueDate', input.dueDate < today(), 'La fecha de entrega no puede ser anterior a hoy'],
    ['receivedMaterialKg', input.isService && !isPositive(input.receivedMaterialKg), 'Ingrese los kg de materia prima recibida'],
  ]);
  if (errors) return fail(errors);
  const id = newId('ped');
  const code = nextCode('PED', db().salesOrders.map((s) => s.code));
  update((d) => ({
    salesOrders: [
      ...d.salesOrders,
      {
        id,
        code,
        customerId: input.customerId!,
        productId: input.productId!,
        quantity: input.quantity,
        dueDate: input.dueDate,
        isService: input.isService,
        receivedMaterialKg: input.isService ? input.receivedMaterialKg : undefined,
        status: 'pending',
        createdBy: me(),
        createdAt: nowIso(),
      },
    ],
  }));
  return ok(id);
}

export function cancelSalesOrder(id: string) {
  update((d) => ({ salesOrders: d.salesOrders.map((s) => (s.id === id && s.status === 'pending' ? { ...s, status: 'cancelled' } : s)) }));
}

// ---------------- production orders (RF-11, RF-12, RF-20) ----------------

export type StageAssignment = Partial<Record<StageType, { machineId?: string; operatorIds: string[] }>>;

/** True when every stage of the route has its machine (except packing) and at least one operator. */
export function isFullyAssigned(route: StageType[], plan: StageAssignment): boolean {
  return route.every((s) => (plan[s]?.operatorIds.length ?? 0) > 0 && (!sectionOf(s) || !!plan[s]?.machineId));
}

export function createOrder(salesOrderId: string, plan: StageAssignment): Result<string> {
  const so = db().salesOrders.find((s) => s.id === salesOrderId);
  if (!so || so.status !== 'pending') return fail({ form: 'El pedido ya tiene orden o fue anulado' });
  const product = db().products.find((p) => p.id === so.productId)!;
  const recipe = currentRecipe(db(), product.id);
  const route = buildRoute(product.type);
  if (!recipe) return fail({ form: 'La funda no tiene una receta aprobada (RF-08)' });
  if (!isFullyAssigned(route, plan)) return fail({ form: 'Asigne máquina y operarios a todas las etapas' });
  const id = newId('op');
  const code = nextCode('OP', db().orders.map((o) => o.code));
  update((d) => ({
    orders: [...d.orders, { id, code, salesOrderId, recipeId: recipe.id, weightKg: unitsToWeight(so.quantity, product.weightG).kg, status: 'pending', createdBy: me(), createdAt: nowIso() }],
    stages: [
      ...d.stages,
      ...route.map((type, i) => ({
        id: `${id}-${stageCodes[type].toLowerCase()}`,
        orderId: id,
        type,
        sequence: i + 1,
        machineId: sectionOf(type) ? plan[type]!.machineId : undefined,
        operatorIds: plan[type]!.operatorIds,
        status: 'pending' as const,
      })),
    ],
    salesOrders: d.salesOrders.map((s) => (s.id === salesOrderId ? { ...s, status: 'ordered' } : s)),
  }));
  audit('Orden de producción', id, 'Liberación a planta', undefined, `${code} Pendiente`);
  return ok(id);
}

// ---------------- plant (mobile) (RF-15 to RF-18, RF-21, RF-23) ----------------

export function startOperation(stageId: string, operatorId: string): Result<string> {
  if (db().timeEntries.some((t) => t.operatorId === operatorId && !t.end)) return fail({ form: 'Ya tiene una operación en curso' });
  const stage = db().stages.find((s) => s.id === stageId)!;
  const order = db().orders.find((o) => o.id === stage.orderId)!;
  if (order.status !== 'pending' && order.status !== 'inProgress') return fail({ form: 'La orden no admite registros' });
  const id = newId('te');
  update((d) => ({
    timeEntries: [...d.timeEntries, { id, stageId, operatorId, machineId: stage.machineId, start: nowIso(), pauses: [] }],
    stages: d.stages.map((s) => (s.id === stageId ? { ...s, status: 'inProgress' } : s)),
    // The first time record moves the order to "En proceso" (RF-20).
    orders: d.orders.map((o) => (o.id === order.id && o.status === 'pending' ? { ...o, status: 'inProgress' } : o)),
  }));
  useUiStore.getState().queueSync();
  return ok(id);
}

export function pauseOperation(entryId: string, type: PauseType) {
  update((d) => ({
    timeEntries: d.timeEntries.map((t) => (t.id === entryId && !openPause(t) ? { ...t, pauses: [...t.pauses, { type, start: nowIso() }] } : t)),
  }));
  useUiStore.getState().queueSync();
}

export function resumeOperation(entryId: string) {
  const at = nowIso();
  update((d) => ({
    timeEntries: d.timeEntries.map((t) => (t.id === entryId ? { ...t, pauses: t.pauses.map((p) => (p.end ? p : { ...p, end: at })) } : t)),
  }));
  useUiStore.getState().queueSync();
}

/** Ends the operator's timer; the stage is done when nobody else is still working on it. */
export function finishOperation(entryId: string) {
  const at = nowIso();
  const entry = db().timeEntries.find((t) => t.id === entryId)!;
  update((d) => {
    const timeEntries = d.timeEntries.map((t) => (t.id === entryId ? { ...t, end: at, pauses: t.pauses.map((p) => (p.end ? p : { ...p, end: at })) } : t));
    const othersRunning = timeEntries.some((t) => t.stageId === entry.stageId && !t.end);
    return { timeEntries, stages: d.stages.map((s) => (s.id === entry.stageId && !othersRunning ? { ...s, status: 'done' } : s)) };
  });
  useUiStore.getState().queueSync();
}

export function recordProduction(stageId: string, operatorId: string, data: { rawMaterialKg?: number; rollKg?: number; units?: number }): Result {
  const stage = db().stages.find((s) => s.id === stageId)!;
  const errors =
    stage.type === 'extrusion'
      ? check([
          ['rawMaterialKg', !isPositive(data.rawMaterialKg), 'Ingrese los kg de materia prima usada'],
          ['rollKg', !isPositive(data.rollKg), 'Ingrese los kg de rollo'],
          ['rollKg', (data.rollKg ?? 0) > (data.rawMaterialKg ?? 0), 'El rollo no puede pesar más que la materia prima usada'],
        ])
      : check([['units', !isPositive(data.units) || !Number.isInteger(data.units), 'Ingrese las unidades producidas']]);
  if (errors) return fail(errors);
  update((d) => ({
    productionRecords: [...d.productionRecords, { id: newId('pr'), stageId, operatorId, machineId: stage.machineId, at: nowIso(), ...data }],
  }));
  useUiStore.getState().queueSync();
  return ok(undefined);
}

/** Records waste; when the order goes over the threshold the supervisor is notified (RF-17). */
export function recordWaste(stageId: string, operatorId: string, kg: number, destination?: WasteDestination): Result<{ alert: boolean; fraction: number }> {
  const errors = check([
    ['kg', !isPositive(kg), 'Ingrese los kg de merma'],
    ['destination', !destination, 'Seleccione el destino de la merma'],
  ]);
  if (errors) return fail(errors);
  const stage = db().stages.find((s) => s.id === stageId)!;
  const before = orderWaste(db(), stage.orderId);
  update((d) => ({ wasteRecords: [...d.wasteRecords, { id: newId('wr'), stageId, operatorId, kg, destination: destination!, at: nowIso() }] }));
  const after = orderWaste(db(), stage.orderId);
  if (after.alert && !before.alert) {
    const supervisors = db().users.filter((u) => u.role === 'sup' && u.active);
    update((d) => ({
      notifications: [
        ...d.notifications,
        ...supervisors.map((u) => ({
          id: newId('nt'),
          userId: u.id,
          at: nowIso(),
          orderId: stage.orderId,
          message: `Merma de ${orderCode(stage.orderId)} en ${formatPercent(after.fraction)}: supera el máximo de ${formatPercent(d.settings.maxWastePct, 0)}`,
          read: false,
        })),
      ],
    }));
  }
  useUiStore.getState().queueSync();
  return ok({ alert: after.alert, fraction: after.fraction });
}

/** Packing count closes the order and sends it to validation (RF-18). */
export function closeAtPacking(orderId: string, operatorId: string, finalCount: number, bundles: number): Result {
  const errors = check([
    ['finalCount', !isPositive(finalCount) || !Number.isInteger(finalCount), 'Ingrese el conteo final'],
    ['bundles', !isPositive(bundles) || !Number.isInteger(bundles), 'Ingrese el número de bultos'],
  ]);
  if (errors) return fail(errors);
  const order = db().orders.find((o) => o.id === orderId)!;
  if (!canTransition(order.status, 'toValidate')) return fail({ form: 'La orden no está en proceso' });
  const running = db().timeEntries.find((t) => t.operatorId === operatorId && !t.end);
  if (running) finishOperation(running.id);
  update((d) => ({
    orders: d.orders.map((o) => (o.id === orderId ? { ...o, status: 'toValidate', finalCount, bundles, packedAt: nowIso(), returnNote: undefined } : o)),
    stages: d.stages.map((s) => (s.orderId === orderId && s.type === 'packing' ? { ...s, status: 'done' } : s)),
  }));
  audit('Orden de producción', orderId, 'Cierre en empacado', 'En proceso', `Por validar · ${formatNumber(finalCount)} u en ${bundles} bultos`);
  useUiStore.getState().queueSync();
  return ok(undefined);
}

// ---------------- supervision (RF-19, RF-22) ----------------

/** Validates the closing: the order is closed and its cost snapshot is computed (RF-19, RF-31 to RF-33). */
export function validateOrder(orderId: string): Result<OrderCost> {
  const order = db().orders.find((o) => o.id === orderId)!;
  if (!canTransition(order.status, 'closed')) return fail({ form: 'Solo se validan órdenes "Por validar"' });
  const at = nowIso();
  update((d) => ({ orders: d.orders.map((o) => (o.id === orderId ? { ...o, status: 'closed', closedBy: me(), closedAt: at } : o)) }));
  const cost = computeOrderCost(db(), orderId, at);
  update((d) => ({ orderCosts: [...d.orderCosts.filter((c) => c.orderId !== orderId), cost] }));
  audit('Orden de producción', orderId, 'Validación de cierre', 'Por validar', 'Cerrada');
  audit('Costo de orden', orderId, 'Cálculo', undefined, `${order.code}: CT ${formatMoney(cost.total)} · CU ${formatUnitCost(cost.unitCost)}`);
  return ok(cost);
}

/** Sends the order back to the operators with an observation (RF-19). */
export function returnOrder(orderId: string, note: string): Result {
  if (!note.trim()) return fail({ note: 'Ingrese la observación para el operario' });
  const order = db().orders.find((o) => o.id === orderId)!;
  if (order.status !== 'toValidate') return fail({ form: 'Solo se devuelven órdenes "Por validar"' });
  const operatorIds = [...new Set(db().stages.filter((s) => s.orderId === orderId).flatMap((s) => s.operatorIds))];
  update((d) => ({
    orders: d.orders.map((o) => (o.id === orderId ? { ...o, status: 'inProgress', returnNote: note.trim() } : o)),
    stages: d.stages.map((s) => (s.orderId === orderId && s.type === 'packing' ? { ...s, status: 'pending' } : s)),
    notifications: [
      ...d.notifications,
      ...operatorIds.map((userId) => ({ id: newId('nt'), userId, at: nowIso(), orderId, message: `${order.code} devuelta por el supervisor: ${note.trim()}`, read: false })),
    ],
  }));
  audit('Orden de producción', orderId, 'Devolución', 'Por validar', `En proceso: ${note.trim()}`);
  return ok(undefined);
}

export function correctTimeEntry(entryId: string, start: string, end: string, reason: string): Result {
  const entry = db().timeEntries.find((t) => t.id === entryId)!;
  const errors = check([
    ['reason', !reason.trim(), 'La corrección exige un motivo'],
    ['end', !(end > start), 'El fin debe ser posterior al inicio'],
  ]);
  if (errors) return fail(errors);
  update((d) => ({
    timeEntries: d.timeEntries.map((t) => (t.id === entryId ? { ...t, start, end, correction: { by: me(), at: nowIso(), reason: reason.trim() } } : t)),
  }));
  const span = (s: string, e?: string) => `${formatTime(s)} – ${e ? formatTime(e) : 'en curso'}`;
  audit('Marcación', entryId, `Corrección: ${reason.trim()}`, span(entry.start, entry.end), span(start, end));
  return ok(undefined);
}

export function markNotificationsRead(userId: string) {
  update((d) => ({ notifications: d.notifications.map((n) => (n.userId === userId ? { ...n, read: true } : n)) }));
}

// ---------------- prices and resource costs (RF-26, RF-29, RF-30) ----------------

export function saveSupplierPrice(input: { materialId?: string; supplierId?: string; price: number; leadTimeDays?: number; validFrom: string }): Result<{ affects: boolean }> {
  const supplier = db().suppliers.find((s) => s.id === input.supplierId);
  const errors = check([
    ['materialId', !input.materialId, 'Seleccione el insumo'],
    ['supplierId', !supplier, 'Seleccione el proveedor'],
    ['price', !isPositive(input.price), 'Ingrese un precio mayor que cero'],
    ['leadTimeDays', supplier?.origin === 'imported' && !isPositive(input.leadTimeDays), 'Un precio importado exige el plazo de llegada en días'],
    ['validFrom', !/^\d{4}-\d{2}-\d{2}$/.test(input.validFrom), 'Ingrese la vigencia como dd/mm/aaaa'],
  ]);
  if (errors) return fail(errors);
  const at = nowIso();
  const oldPrice = referencePrice(db().supplierPrices, db().suppliers, input.materialId!, at);
  const previousOwn = [...db().supplierPrices].reverse().find((p) => p.materialId === input.materialId && p.supplierId === input.supplierId);
  const id = newId('sp');
  update((d) => ({
    supplierPrices: [
      ...d.supplierPrices,
      { id, materialId: input.materialId!, supplierId: input.supplierId!, price: input.price, leadTimeDays: supplier!.origin === 'imported' ? input.leadTimeDays : undefined, validFrom: input.validFrom, createdBy: me() },
    ],
  }));
  const material = db().materials.find((m) => m.id === input.materialId)!;
  audit(
    'Precio de proveedor',
    id,
    'Creación',
    previousOwn ? `${material.code} ${supplier!.name} ${formatNumber(previousOwn.price, 2)} USD` : undefined,
    `${material.code} ${supplier!.name} ${formatNumber(input.price, 2)} USD`,
  );
  const newPrice = referencePrice(db().supplierPrices, db().suppliers, input.materialId!, at);
  useUiStore.getState().setLastPriceChange({ materialId: input.materialId!, supplierId: input.supplierId!, oldPrice, newPrice, at });
  return ok({ affects: newPrice !== oldPrice });
}

export function savePositionRate(positionId: string, hourlyCost: number, validFrom: string): Result {
  const errors = check([
    ['hourlyCost', !isPositive(hourlyCost), 'Ingrese un costo por hora mayor que cero'],
    ['validFrom', !/^\d{4}-\d{2}-\d{2}$/.test(validFrom), 'Ingrese la vigencia como dd/mm/aaaa'],
  ]);
  if (errors) return fail(errors);
  const name = db().positions.find((p) => p.id === positionId)!.name;
  const before = [...db().positionRates].reverse().find((r) => r.positionId === positionId);
  update((d) => ({ positionRates: [...d.positionRates, { id: newId('prt'), positionId, hourlyCost, validFrom, createdBy: me() }] }));
  audit('Costo hora cargo', positionId, 'Modificación', before && `${name} ${formatNumber(before.hourlyCost, 2)} USD/h`, `${name} ${formatNumber(hourlyCost, 2)} USD/h`);
  return ok(undefined);
}

export function saveMachineRate(machineId: string, hourlyCost: number, validFrom: string): Result {
  const errors = check([
    ['hourlyCost', !isPositive(hourlyCost), 'Ingrese un costo por hora mayor que cero'],
    ['validFrom', !/^\d{4}-\d{2}-\d{2}$/.test(validFrom), 'Ingrese la vigencia como dd/mm/aaaa'],
  ]);
  if (errors) return fail(errors);
  const code = db().machines.find((m) => m.id === machineId)!.code;
  const before = [...db().machineRates].reverse().find((r) => r.machineId === machineId);
  update((d) => ({ machineRates: [...d.machineRates, { id: newId('mrt'), machineId, hourlyCost, validFrom, createdBy: me() }] }));
  audit('Costo hora máquina', machineId, 'Modificación', before && `${code} ${formatNumber(before.hourlyCost, 2)} USD/h`, `${code} ${formatNumber(hourlyCost, 2)} USD/h`);
  return ok(undefined);
}

export function updateSettings(patch: Partial<Settings>) {
  update((d) => ({ settings: { ...d.settings, ...patch } }));
}

// ---------------- reference prices (RF-36 to RF-38) ----------------

export function proposePrice(input: { productId: string; baseUnitCost: number; margin: number; method: MarginMethod; price: number; quantity?: number }): Result<string> {
  const errors = check([
    ['margin', !(input.margin > 0) || input.margin >= 1, 'El margen debe estar entre 0 % y 100 %'],
    ['price', !isPositive(input.price), 'El precio debe ser mayor que cero'],
  ]);
  if (errors) return fail(errors);
  const id = newId('pp');
  update((d) => ({ priceProposals: [...d.priceProposals, { id, ...input, status: 'proposed', proposedBy: me(), proposedAt: nowIso() }] }));
  audit('Precio referencial', id, 'Propuesta', undefined, `${productCode(input.productId)} ${formatUnitCost(input.price)} (margen ${formatPercent(input.margin)})`);
  return ok(id);
}

export function approveProposal(id: string, justification: string): Result {
  const p = db().priceProposals.find((x) => x.id === id)!;
  const product = db().products.find((x) => x.id === p.productId)!;
  const line = db().productLines.find((l) => l.id === product.lineId)!;
  if (belowMinimum(p.margin, line.minMargin) && !justification.trim()) {
    return fail({ justification: `El margen está bajo el mínimo de la línea (${formatPercent(line.minMargin, 0)}): ingrese la justificación` });
  }
  const previous = currentReferencePrice(db().priceProposals, p.productId);
  update((d) => ({
    priceProposals: d.priceProposals.map((x) => (x.id === id ? { ...x, status: 'approved', decidedBy: me(), decidedAt: nowIso(), justification: justification.trim() || undefined } : x)),
  }));
  audit(
    'Precio referencial',
    id,
    justification.trim() ? `Aprobación con justificación: ${justification.trim()}` : 'Aprobación',
    previous ? `${product.code} ${formatUnitCost(previous.price)}` : 'Propuesta',
    `${product.code} ${formatUnitCost(p.price)}`,
  );
  return ok(undefined);
}

export function rejectProposal(id: string, reason: string): Result {
  if (!reason.trim()) return fail({ reason: 'Ingrese el motivo del rechazo' });
  const p = db().priceProposals.find((x) => x.id === id)!;
  update((d) => ({ priceProposals: d.priceProposals.map((x) => (x.id === id ? { ...x, status: 'rejected', decidedBy: me(), decidedAt: nowIso(), rejectionReason: reason.trim() } : x)) }));
  audit('Precio referencial', id, 'Rechazo', 'Propuesta', `${productCode(p.productId)} ${formatUnitCost(p.price)} rechazado: ${reason.trim()}`);
  return ok(undefined);
}

// ---------------- Dobra (RF-43, RF-44) ----------------

/** Builds the export file with approved prices only and records it (RF-43). */
export function exportToDobra(productIds: string[]): Result<{ fileName: string; csv: string }> {
  const at = nowIso();
  const rows = productIds
    .map((id) => {
      const product = db().products.find((p) => p.id === id)!;
      const price = currentReferencePrice(db().priceProposals, id);
      return price && { code: product.code, name: product.name, unitCost: standardCost(db(), id, at).unitCost, price: price.price, date: dateKey(at) };
    })
    .filter((r): r is NonNullable<typeof r> => Boolean(r));
  if (!rows.length) return fail({ form: 'Seleccione al menos una funda con precio aprobado' });
  const stamp = at.slice(0, 16).replace(/[-:T]/g, '');
  const fileName = `segucost_dobra_${stamp.slice(0, 8)}_${stamp.slice(8)}.csv`;
  update((d) => ({ dobraExports: [...d.dobraExports, { id: newId('dx'), at, userId: me(), fileName, productIds }] }));
  audit('Exportación Dobra', fileName, 'Generación de archivo', undefined, `${rows.length} fundas`);
  return ok({ fileName, csv: buildExportCsv(rows) });
}

/** Loads the valid rows of a catalog file and reports the rejected ones (RF-44). */
export function importCatalog(text: string): ImportResult {
  const d = db();
  const result = validateCatalogImport(text, d);
  update((s) => ({
    materials: [...s.materials, ...result.materials.map((m) => ({ ...m, id: newId('m') }))],
    products: [...s.products, ...result.products.map((p) => ({ ...p, id: newId('p') }))],
    suppliers: [...s.suppliers, ...result.suppliers.map((x) => ({ ...x, id: newId('s') }))],
  }));
  const loaded = result.materials.length + result.products.length + result.suppliers.length;
  audit('Importación de catálogo', 'catalogo', 'Carga de plantilla', undefined, `${loaded} cargadas · ${result.rejected.length} rechazadas · ${result.skipped.length} existentes`);
  return result;
}
