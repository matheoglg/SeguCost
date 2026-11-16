// Business operations of the prototype. Each one validates its input, updates the shared store and,
// when the SRS asks for it, writes the audit log (RF-04). Screens call these and show the result (RNF-04).
import { computeOrderCost, currentRecipe, standardCost } from '@/domain/costing';
import { validateImport, type CatalogImport } from '@/domain/csvImport';
import { materialTypeLabels, materialUnitLabels, roleLabels, stageCodes } from '@/domain/labels';
import { DEMO_PASSWORD } from '@/data/seed';
import { dateKey, inForce, referenceQuote } from '@/domain/prices';
import { belowMinimum, currentReferencePrice } from '@/domain/pricing';
import { canTransition, orderWaste, openPause } from '@/domain/production';
import { buildRoute, sectionOf } from '@/domain/routing';
import { unitsToWeight } from '@/domain/conversion';
import { check, fail, isPositive, ok, type Result } from '@/domain/validation';
import { formatDate, formatMoney, formatNumber, formatPercent, formatTime, formatUnitCost } from '@/format';
import type {
  Database,
  MarginMethod,
  MaterialType,
  MaterialUnit,
  OrderCost,
  Origin,
  RuleKey,
  PauseType,
  ProductType,
  RecipeItem,
  Role,
  Settings,
  StageType,
  WasteDestination,
} from '@/domain/types';
import { newId, useDataStore } from './data';
import { approvedPrices, type ApprovedPrice } from './selectors';
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

// ---------------- accounts (RF-03, RF-05) ----------------

const plain = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Free username from the name: "Jorge Castillo Vera" -> "jcastillo" (then "jcastillo2"...). */
export function suggestUsername(name: string, taken: string[] = db().users.map((u) => u.username)): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const base = plain(words[0][0] + (words[1] ?? words[0].slice(1)));
  let candidate = base;
  for (let n = 2; taken.includes(candidate); n++) candidate = `${base}${n}`;
  return candidate;
}

export function saveUser(input: { id?: string; name: string; username: string; role?: Role; active: boolean }): Result<string> {
  const username = input.username.trim().toLowerCase();
  const name = input.name.trim();
  const duplicate = db().users.some((u) => u.username === username && u.id !== input.id);
  const errors = check([
    ['name', !name, 'Ingrese los nombres completos.'],
    ['username', !username, 'Ingrese el usuario.'],
    ['username', !/^[a-z0-9._-]+$/.test(username), 'Use solo letras minúsculas, números, punto o guion, sin espacios.'],
    ['username', duplicate, `Ese usuario ya existe. Pruebe con “${suggestUsername(name || username)}”.`],
    ['role', !input.role, 'Elija uno de los cuatro roles.'],
  ]);
  if (errors) return fail(errors);
  const id = input.id ?? newId('u');
  const existing = db().users.find((u) => u.id === id);
  const role = input.role!;
  update((d) => ({
    users: existing
      ? d.users.map((u) => (u.id === id ? { ...u, name, username, role, active: input.active } : u))
      : [...d.users, { id, name, username, password: DEMO_PASSWORD, role, active: input.active, createdAt: nowIso(), mustChangePassword: true }],
  }));
  if (!existing) audit('Cuenta', username, 'Creó', undefined, `${roleLabels[role]} · ${input.active ? 'Activa' : 'Inactiva'}`);
  else {
    if (existing.role !== role) audit('Cuenta', username, 'Cambió rol', roleLabels[existing.role], roleLabels[role]);
    if (existing.active !== input.active) audit('Cuenta', username, input.active ? 'Reactivó' : 'Desactivó', existing.active ? 'Activa' : 'Inactiva', input.active ? 'Activa' : 'Inactiva');
    if (existing.name !== name || existing.username !== username) audit('Cuenta', username, 'Modificó', `${existing.name} · ${existing.username}`, `${name} · ${username}`);
  }
  return ok(id);
}

/** Deactivating keeps the account and its history; it only blocks new logins (RF-03). */
export function setUserActive(id: string, active: boolean) {
  const user = db().users.find((u) => u.id === id)!;
  if (user.active === active) return;
  update((d) => ({ users: d.users.map((u) => (u.id === id ? { ...u, active } : u)) }));
  audit('Cuenta', user.username, active ? 'Reactivó' : 'Desactivó', active ? 'Inactiva' : 'Activa', active ? 'Activa' : 'Inactiva');
}

/** Temporary password demo123; the user must change it on the next login (RF-03). */
export function resetPassword(id: string) {
  const user = db().users.find((u) => u.id === id)!;
  update((d) => ({ users: d.users.map((u) => (u.id === id ? { ...u, password: DEMO_PASSWORD, mustChangePassword: true } : u)) }));
  audit('Cuenta', user.username, 'Restableció contraseña', undefined, 'Cambio obligatorio al ingresar');
}

export function changePassword(userId: string, password: string, confirm: string): Result {
  const errors = check([
    ['password', password.length < 6, 'Use al menos 6 caracteres.'],
    ['password', password === DEMO_PASSWORD, 'Use una contraseña distinta de la temporal.'],
    ['confirm', password !== confirm, 'Las dos contraseñas no coinciden.'],
  ]);
  if (errors) return fail(errors);
  update((d) => ({ users: d.users.map((u) => (u.id === userId ? { ...u, password, mustChangePassword: false } : u)) }));
  return ok(undefined);
}

// ---------------- materials (RF-06) ----------------

/** Enabled formulas (the current approved version of each product) that use a material. */
export function formulasUsing(materialId: string, d: Database = db()): string[] {
  return d.products
    .map((p) => currentRecipe(d, p.id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r) && r!.items.some((i) => i.materialId === materialId))
    .map((r) => r.id);
}

export function saveMaterial(input: { id?: string; code: string; name: string; type?: MaterialType; unit?: MaterialUnit }): Result<string> {
  const name = input.name.trim();
  const existing = db().materials.find((m) => m.id === input.id);
  // The code of an existing material does not change: formulas and prices use it.
  const code = existing ? existing.code : input.code.trim().toUpperCase();
  const errors = check([
    ['code', !code, 'Ingrese el código.'],
    ['code', !/^[A-Z0-9-]+$/.test(code), 'Use letras, números y guion, sin espacios.'],
    ['code', db().materials.some((m) => m.active && m.code === code && m.id !== input.id), 'Ya existe un insumo activo con este código.'],
    ['name', !name, 'Ingrese el nombre.'],
    ['type', !input.type, 'Elija la categoría.'],
    ['unit', !input.unit, 'Elija la unidad.'],
  ]);
  if (errors) return fail(errors);
  const id = input.id ?? newId('m');
  update((d) => ({
    materials: existing
      ? d.materials.map((m) => (m.id === id ? { ...m, name, type: input.type!, unit: input.unit! } : m))
      : [...d.materials, { id, code, name, type: input.type!, unit: input.unit!, active: true }],
  }));
  const describe = (m: { name: string; type: MaterialType; unit: MaterialUnit }) => `${m.name} · ${materialTypeLabels[m.type]} · ${materialUnitLabels[m.unit]}`;
  const after = describe({ name, type: input.type!, unit: input.unit! });
  if (!existing) audit('Insumo', code, 'Creó', undefined, after);
  else if (describe(existing) !== after) audit('Insumo', code, 'Modificó', describe(existing), after);
  return ok(id);
}

/** A deactivated material stays in history and in existing formulas, but is not offered in new ones (RF-06). */
export function setMaterialActive(id: string, active: boolean): Result {
  const m = db().materials.find((x) => x.id === id)!;
  if (active && db().materials.some((x) => x.active && x.code === m.code && x.id !== id)) {
    return fail({ code: 'Ya existe un insumo activo con este código.' });
  }
  update((d) => ({ materials: d.materials.map((x) => (x.id === id ? { ...x, active } : x)) }));
  audit('Insumo', m.code, active ? 'Reactivó' : 'Desactivó', active ? 'Inactivo' : 'Activo', active ? 'Activo' : 'Inactivo');
  return ok(undefined);
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

// ---------------- costing parameters (RF-25, RF-41) ----------------

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const usdH = (n: number) => `${formatNumber(n, 2)} USD/h`;

/** New rate for a plant position; the previous one stays in history (RF-41). */
export function savePositionRate(positionId: string, hourlyCost: number, validFrom: string): Result {
  const errors = check([
    ['hourlyCost', !isPositive(hourlyCost), 'Ingrese una tarifa mayor que cero.'],
    ['validFrom', !ISO_DAY.test(validFrom), 'Ingrese la fecha como dd/mm/aaaa.'],
  ]);
  if (errors) return fail(errors);
  const name = db().positions.find((p) => p.id === positionId)!.name;
  const before = inForce(db().positionRates.filter((r) => r.positionId === positionId), validFrom);
  update((d) => ({ positionRates: [...d.positionRates, { id: newId('prt'), positionId, hourlyCost, validFrom, createdBy: me() }] }));
  audit('Tarifa', name.replace('Operario de ', 'Op. '), 'Modificó', before && usdH(before.hourlyCost), `${usdH(hourlyCost)} desde ${formatDate(validFrom)}`);
  return ok(undefined);
}

/** Machine rate, throughput and status (RF-25, RF-41). */
export function saveMachine(machineId: string, input: { hourlyCost: number; kgPerHour: number; active: boolean; validFrom: string }): Result {
  const machine = db().machines.find((m) => m.id === machineId)!;
  const current = inForce(db().machineRates.filter((r) => r.machineId === machineId), input.validFrom);
  const errors = check([
    ['hourlyCost', !isPositive(input.hourlyCost), 'Ingrese una tarifa mayor que cero.'],
    ['kgPerHour', !isPositive(input.kgPerHour), 'Ingrese el rendimiento en kg/h, mayor que cero.'],
    ['validFrom', !ISO_DAY.test(input.validFrom), 'Ingrese la fecha como dd/mm/aaaa.'],
  ]);
  if (errors) return fail(errors);
  if (!current || current.hourlyCost !== input.hourlyCost) {
    update((d) => ({ machineRates: [...d.machineRates, { id: newId('mrt'), machineId, hourlyCost: input.hourlyCost, validFrom: input.validFrom, createdBy: me() }] }));
    audit('Tarifa', machine.code, 'Modificó', current && usdH(current.hourlyCost), `${usdH(input.hourlyCost)} desde ${formatDate(input.validFrom)}`);
  }
  if (machine.kgPerHour !== input.kgPerHour || machine.active !== input.active) {
    update((d) => ({ machines: d.machines.map((m) => (m.id === machineId ? { ...m, kgPerHour: input.kgPerHour, active: input.active } : m)) }));
    const state = (m: { kgPerHour: number; active: boolean }) => `${formatNumber(m.kgPerHour)} kg/h · ${m.active ? 'Operativa' : 'En mantenimiento'}`;
    audit('Máquina', machine.code, 'Modificó', state(machine), state(input));
  }
  return ok(undefined);
}

export function saveIndirectRate(hourlyCost: number, validFrom: string): Result {
  const errors = check([
    ['indirect', !isPositive(hourlyCost), 'Ingrese una tasa mayor que cero.'],
    ['validFrom', !ISO_DAY.test(validFrom), 'Ingrese la fecha como dd/mm/aaaa.'],
  ]);
  if (errors) return fail(errors);
  const before = inForce(db().indirectRates, validFrom);
  update((d) => ({ indirectRates: [...d.indirectRates, { id: newId('ind'), hourlyCost, validFrom, createdBy: me() }] }));
  audit('Tarifa', 'Indirectos', 'Modificó', before && usdH(before.hourlyCost), `${usdH(hourlyCost)} desde ${formatDate(validFrom)}`);
  return ok(undefined);
}

export const RULE_LABELS: Record<RuleKey, string> = {
  minMargin: 'Ganancia mínima',
  maxWastePct: 'Umbral de merma',
  balanceTolerance: 'Tolerancia del balance',
};

/** Commercial and production rules with validity date; closed orders keep their values (RF-41). */
export function saveRules(values: Record<RuleKey, number>, validFrom: string): Result<number> {
  const errors = check([
    ['minMargin', !(values.minMargin >= 0 && values.minMargin < 10), 'Ingrese un porcentaje entre 0 y 1.000.'],
    ['maxWastePct', !(values.maxWastePct > 0 && values.maxWastePct < 1), 'Ingrese un porcentaje mayor que 0 y menor que 100.'],
    ['balanceTolerance', !(values.balanceTolerance > 0 && values.balanceTolerance < 1), 'Ingrese un porcentaje mayor que 0 y menor que 100.'],
    ['validFrom', !ISO_DAY.test(validFrom), 'Ingrese la fecha como dd/mm/aaaa.'],
  ]);
  if (errors) return fail(errors);
  let changed = 0;
  for (const key of Object.keys(values) as RuleKey[]) {
    const current = db().settings[key];
    if (Math.abs(current - values[key]) < 1e-9) continue;
    changed++;
    update((d) => ({
      ruleRates: [...d.ruleRates, { id: newId('rule'), key, value: values[key], validFrom, createdBy: me() }],
      settings: { ...d.settings, [key]: values[key] },
    }));
    audit('Regla', RULE_LABELS[key], 'Modificó', formatPercent(current), formatPercent(values[key]));
  }
  return ok(changed);
}

/** Kept for the previous version screens. */
export function updateSettings(patch: Partial<Settings>) {
  update((d) => ({ settings: { ...d.settings, ...patch } }));
}

// ---------------- suppliers and raw material prices (RF-42, RF-43, RF-44) ----------------

export function saveSupplier(input: { name: string; origin?: Origin; contact?: string }): Result<string> {
  const name = input.name.trim();
  const errors = check([
    ['supplierName', !name, 'Ingrese el nombre del proveedor.'],
    ['supplierName', db().suppliers.some((s) => s.active !== false && s.name.toLowerCase() === name.toLowerCase()), 'Ya existe un proveedor activo con ese nombre.'],
    ['origin', !input.origin, 'Elija si es local o importado.'],
  ]);
  if (errors) return fail(errors);
  const id = newId('s');
  update((d) => ({ suppliers: [...d.suppliers, { id, name, origin: input.origin!, contact: input.contact?.trim() || undefined, active: true }] }));
  audit('Proveedor', name, 'Creó', undefined, input.origin === 'imported' ? 'Importado' : 'Local');
  return ok(id);
}

/** New price reference from a purchase invoice; invoices and Dobra data do not change (RF-43). */
export function saveSupplierPrice(input: {
  materialId?: string;
  supplierId?: string;
  price: number;
  priceUnit?: MaterialUnit;
  leadTimeDays?: number;
  includes?: string;
  validFrom: string;
}): Result<string> {
  const supplier = db().suppliers.find((s) => s.id === input.supplierId);
  const errors = check([
    ['materialId', !input.materialId, 'Elija la materia prima.'],
    ['supplierId', !supplier, 'Elija el proveedor.'],
    ['supplierId', supplier?.active === false, 'El proveedor está desactivado: no admite precios nuevos.'],
    ['price', !isPositive(input.price), 'Ingrese un precio mayor que cero.'],
    ['leadTimeDays', supplier?.origin === 'imported' && !isPositive(input.leadTimeDays), 'Un precio importado exige el plazo de llegada en días.'],
    ['includes', !input.includes?.trim(), supplier?.origin === 'imported' ? 'Indique qué incluye, por ejemplo «Producto y flete».' : 'Indique qué incluye, por ejemplo «Transporte; IVA aparte».'],
    ['validFrom', !ISO_DAY.test(input.validFrom), 'Ingrese la fecha como dd/mm/aaaa.'],
  ]);
  if (errors) return fail(errors);
  const material = db().materials.find((m) => m.id === input.materialId)!;
  const previous = inForce(db().supplierPrices.filter((p) => p.materialId === material.id && p.supplierId === supplier!.id), input.validFrom);
  const id = newId('sp');
  update((d) => ({
    supplierPrices: [
      ...d.supplierPrices,
      {
        id,
        materialId: material.id,
        supplierId: supplier!.id,
        price: input.price,
        priceUnit: input.priceUnit && input.priceUnit !== material.unit ? input.priceUnit : undefined,
        leadTimeDays: input.leadTimeDays,
        includes: input.includes!.trim(),
        validFrom: input.validFrom,
        createdBy: me(),
      },
    ],
  }));
  const unit = input.priceUnit === 'lb' ? 'USD/lb' : `USD/${material.unit === 'l' ? 'litro' : material.unit}`;
  audit('Precio', `${material.code} · ${supplier!.name}`, 'Registró', previous && `${formatNumber(previous.price, 2)} ${unit}`, `${formatNumber(input.price, 2)} ${unit}`);
  return ok(id);
}

/**
 * Chooses the supplier whose price feeds new estimates (RF-44). Open quotes get a new revision when
 * they are recalculated; accepted ones do not change.
 */
export function setReferenceSupplier(materialId: string, supplierId: string) {
  const material = db().materials.find((m) => m.id === materialId)!;
  const at = nowIso();
  const before = referenceQuote(db().supplierPrices, db().suppliers, materialId, at, db().referencePrices);
  if (before?.supplier.id === supplierId) return;
  const supplier = db().suppliers.find((s) => s.id === supplierId)!;
  update((d) => ({ referencePrices: [...d.referencePrices, { id: newId('ref'), materialId, supplierId, since: at, setBy: me() }] }));
  audit('Precio de referencia', material.code, 'Cambió referencia', before && `${before.supplier.name} ${formatNumber(before.price.price, 2)}`, supplier.name);
}

// ---------------- CSV import (RF-50) ----------------

/** All or nothing: imports only when the file has no errors, and records it in the log (RF-50). */
export function importInitialData(text: string, fileName: string): Result<CatalogImport> {
  const d = db();
  const result = validateImport(text, d);
  if (result.errors.length) return fail({ file: `${result.errors.length} filas tienen errores. No se importó ningún dato: corrija el archivo y vuelva a subirlo.` });
  update((s) => ({
    customers: [...s.customers, ...result.customers.map((c) => ({ ...c, id: newId('c') }))],
    materials: [...s.materials, ...result.materials.map((m) => ({ ...m, id: newId('m') }))],
    products: [
      ...s.products,
      ...result.products.map((p) => ({
        id: newId('p'),
        code: p.code,
        name: p.name,
        widthCm: p.widthCm,
        lengthCm: p.lengthCm,
        gauge: p.gauge,
        weightG: p.weightG,
        type: 'natural' as const,
        lineId: s.productLines[0]?.id ?? 'ln-com',
        active: true,
      })),
    ],
  }));
  audit(
    'Importación',
    fileName,
    'Importó',
    undefined,
    `${result.customers.length} clientes · ${result.materials.length} insumos · ${result.products.length} productos`,
  );
  return ok(result);
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


// ---------------- CSV export of approved costs and prices (RF-51) ----------------

export const EXPORT_COLUMNS = 'codigo,producto,costo_unitario,precio,cotizacion,fecha';

/** Own CSV format until spike SP-01 closes (CLAUDE.md section 9). Dot as decimal separator. */
export function buildApprovedCsv(rows: ApprovedPrice[]): string {
  const q = (t: string) => (/[",]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
  return [EXPORT_COLUMNS, ...rows.map((r) => [r.code, q(r.name), r.unitCost.toFixed(4), r.price.toFixed(4), r.quote, r.date].join(','))].join('\n') + '\n';
}

export function exportApprovedPrices(productIds: string[]): Result<{ fileName: string; csv: string }> {
  const rows = approvedPrices(db()).filter((r) => productIds.includes(r.productId));
  if (!rows.length) return fail({ form: 'Seleccione al menos un producto con precio aprobado.' });
  const at = nowIso();
  const fileName = `costos_precios_${dateKey(at).replace(/-/g, '')}.csv`;
  update((d) => ({ dobraExports: [...d.dobraExports, { id: newId('dx'), at, userId: me(), fileName, productIds: rows.map((r) => r.productId) }] }));
  audit('Exportación', 'CSV', 'Exportó', undefined, `${rows.length} ${rows.length === 1 ? 'producto' : 'productos'}`);
  return ok({ fileName, csv: buildApprovedCsv(rows) });
}
