// The demo flows (CLAUDE.md section 7) driven through the store actions. Flows 3 to 7 still follow
// the previous version and are rewritten flow by flow.
import { currentReferencePrice } from '@/domain/pricing';
import { dateKey } from '@/domain/prices';
import { orderWaste } from '@/domain/production';
import { SAMPLE_FILE_CORRECTED, SAMPLE_FILE_WITH_ERRORS, validateImport, validRows } from '@/domain/csvImport';
import { referencePrice } from '@/domain/prices';
import * as actions from './actions';
import { useDataStore } from './data';
import { attentionItems } from './selectors';
import { useSessionStore } from './session';
import { useUiStore } from './ui';

const db = () => useDataStore.getState().db;
const loginAs = (username: string) => {
  const r = useSessionStore.getState().login(username, 'demo123');
  if (!r.ok) throw new Error(r.error);
};
const inDays = (n: number) => dateKey(new Date(Date.now() + n * 86_400_000).toISOString());
const value = <T>(r: { ok: true; value: T } | { ok: false; errors: Record<string, string> }): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value;
};

beforeEach(() => useDataStore.getState().reset());

describe('login (RF-01, RF-02, RF-03)', () => {
  it('rejects wrong and inactive accounts with the same generic message', () => {
    expect(useSessionStore.getState().login('admin', 'x')).toEqual({ ok: false, error: 'Usuario o contraseña incorrectos' });
    expect(useSessionStore.getState().login('operario3', 'demo123')).toEqual({ ok: false, error: 'Usuario o contraseña incorrectos' });
    expect(useSessionStore.getState().login('ADMIN', 'demo123').ok).toBe(true);
  });
  it('a reset password must be changed on the next login', () => {
    loginAs('admin');
    actions.resetPassword('u-op1');
    expect(db().users.find((u) => u.id === 'u-op1')!.mustChangePassword).toBe(true);
    expect(actions.changePassword('u-op1', 'abc', 'abc')).toMatchObject({ ok: false, errors: { password: 'Use al menos 6 caracteres.' } });
    expect(actions.changePassword('u-op1', 'planta2026', 'planta2027')).toMatchObject({ ok: false, errors: { confirm: 'Las dos contraseñas no coinciden.' } });
    value(actions.changePassword('u-op1', 'planta2026', 'planta2026'));
    expect(useSessionStore.getState().login('operario1', 'planta2026').ok).toBe(true);
  });
});

describe('flow 1: initial setup (Administradora)', () => {
  beforeEach(() => loginAs('admin'));

  it('W-02: rejects a repeated username with a suggestion and audits the role change', () => {
    expect(actions.saveUser({ name: 'Jorge Castillo Vera', username: 'supervisor', role: 'sup', active: true })).toMatchObject({
      ok: false,
      errors: { username: 'Ese usuario ya existe. Pruebe con “jcastillo”.' },
    });
    expect(actions.saveUser({ name: 'Sin rol', username: 'sinrol', active: true })).toMatchObject({ ok: false, errors: { role: 'Elija uno de los cuatro roles.' } });
    const id = value(actions.saveUser({ name: 'Jorge Castillo Vera', username: 'jcastillo', role: 'sup', active: true }));
    value(actions.saveUser({ id, name: 'Jorge Castillo Vera', username: 'jcastillo', role: 'ope', active: true }));
    expect(db().auditLog.at(-1)).toMatchObject({ userId: 'u-admin', entity: 'Cuenta', entityId: 'jcastillo', action: 'Cambió rol', before: 'Supervisor de Planta', after: 'Operario de Producción' });
    actions.setUserActive(id, false);
    expect(db().users.find((u) => u.id === id)).toMatchObject({ active: false });
    expect(useSessionStore.getState().login('jcastillo', 'demo123').ok).toBe(false);
  });

  it('W-20: a file with 2 wrong rows imports nothing; the corrected one imports everything', () => {
    const before = { customers: db().customers.length, materials: db().materials.length };
    const check = validateImport(SAMPLE_FILE_WITH_ERRORS, db());
    expect(check.totalRows).toBe(50);
    expect(validRows(check)).toBe(48);
    expect(check.errors).toEqual([
      { row: 14, type: 'Insumo', field: 'código', problem: 'Ya existe un insumo activo con este código.', value: 'PEAD' },
      { row: 27, type: 'Producto', field: 'peso_unitario_g', problem: 'Campo obligatorio vacío.', value: '—' },
    ]);
    expect(actions.importInitialData(SAMPLE_FILE_WITH_ERRORS, 'carga_inicial.csv').ok).toBe(false);
    expect(db().customers.length).toBe(before.customers);
    const imported = value(actions.importInitialData(SAMPLE_FILE_CORRECTED, 'carga_inicial_corregida.csv'));
    expect(db().materials.length).toBe(before.materials + imported.materials.length);
    expect(db().materials.some((m) => m.code === 'ADT-02')).toBe(true);
    expect(db().auditLog.at(-1)).toMatchObject({ entity: 'Importación', action: 'Importó', entityId: 'carga_inicial_corregida.csv' });
    // importing the same file again is rejected as duplicates, nothing is added twice
    expect(actions.importInitialData(SAMPLE_FILE_CORRECTED, 'otra.csv').ok).toBe(false);
  });

  it('W-03: the code is unique among active materials and is locked when editing', () => {
    expect(actions.saveMaterial({ code: 'pead', name: 'Otro', type: 'resin', unit: 'kg' })).toMatchObject({ ok: false, errors: { code: 'Ya existe un insumo activo con este código.' } });
    value(actions.saveMaterial({ id: 'm-tinta', code: 'OTRO', name: 'Tinta flexográfica base agua', type: 'ink', unit: 'l' }));
    expect(db().materials.find((m) => m.id === 'm-tinta')).toMatchObject({ code: 'TINTA', name: 'Tinta flexográfica base agua' });
    expect(actions.formulasUsing('m-tinta').length).toBeGreaterThan(0);
    value(actions.setMaterialActive('m-tinta', false));
    expect(db().materials.find((m) => m.id === 'm-tinta')!.active).toBe(false);
    // once inactive, the code can be reused by a new material
    value(actions.saveMaterial({ code: 'TINTA', name: 'Tinta nueva', type: 'ink', unit: 'l' }));
  });

  it('W-14: a new rate keeps the previous one in history; rules change from today', () => {
    expect(actions.savePositionRate('pos-sel', 0, inDays(0)).ok).toBe(false);
    value(actions.savePositionRate('pos-sel', 3.05, inDays(1)));
    expect(db().positionRates.filter((r) => r.positionId === 'pos-sel').map((r) => r.hourlyCost)).toEqual([2.8, 2.95, 3.05]);
    value(actions.saveMachine('mc-ext01', { hourlyCost: 8.75, kgPerHour: 26, active: true, validFrom: inDays(0) }));
    expect(db().machines.find((m) => m.id === 'mc-ext01')!.kgPerHour).toBe(26);
    value(actions.saveIndirectRate(2.5, inDays(0)));
    expect(value(actions.saveRules({ minMargin: 0.22, maxWastePct: 0.03, balanceTolerance: 0.005 }, inDays(0)))).toBe(1);
    expect(db().settings.minMargin).toBe(0.22);
    expect(db().ruleRates.filter((r) => r.key === 'minMargin').map((r) => r.value)).toEqual([0.2, 0.22]);
    expect(db().auditLog.at(-1)).toMatchObject({ entity: 'Regla', entityId: 'Ganancia mínima', before: '20,0 %', after: '22,0 %' });
  });

  it('W-15: imported prices need a lead time; choosing a reference changes the estimate price', () => {
    expect(actions.saveSupplierPrice({ materialId: 'm-pebd', supplierId: 's-andinas', price: 1.38, includes: 'Producto y flete', validFrom: inDays(0) })).toMatchObject({
      ok: false,
      errors: { leadTimeDays: 'Un precio importado exige el plazo de llegada en días.' },
    });
    value(actions.saveSupplierPrice({ materialId: 'm-pebd', supplierId: 's-andinas', price: 1.38, leadTimeDays: 35, includes: 'Producto y flete', validFrom: inDays(0) }));
    const now = new Date().toISOString();
    expect(referencePrice(db().supplierPrices, db().suppliers, 'm-pebd', now, db().referencePrices)).toBe(1.58);
    actions.setReferenceSupplier('m-pebd', 's-andinas');
    expect(referencePrice(db().supplierPrices, db().suppliers, 'm-pebd', now, db().referencePrices)).toBe(1.38);
    expect(db().auditLog.at(-1)).toMatchObject({ entity: 'Precio de referencia', entityId: 'PEBD', after: 'Resinas Andinas Import.' });
  });

  it('W-01: the Administradora sees the exception, the order to validate and the price rise', () => {
    const tags = attentionItems(db(), 'adm').map((i) => i.tag);
    expect(tags).toEqual(expect.arrayContaining(['Excepción', 'Cierre', 'Precio']));
    expect(attentionItems(db(), 'adm').find((i) => i.tag === 'Precio')!.title).toBe('PEBD local subió a 1,58 USD/kg');
    expect(attentionItems(db(), 'ope')).toEqual([]);
  });
});

describe('flows 3 to 6: from order to approved price', () => {
  it('runs the full production cycle', () => {
    // Flow 3 - sales order and production order
    loginAs('ventas');
    expect(actions.saveSalesOrder({ customerId: 'c-comercial', productId: 'p-fi4060', quantity: 10_000, dueDate: inDays(-1), isService: false })).toMatchObject({ ok: false });
    const pedId = value(actions.saveSalesOrder({ customerId: 'c-comercial', productId: 'p-fi4060', quantity: 10_000, dueDate: inDays(10), isService: false }));
    loginAs('supervisor');
    const partial = { extrusion: { machineId: 'mc-ext02', operatorIds: ['u-op1'] } };
    expect(actions.isFullyAssigned(['extrusion', 'printing', 'sealing', 'packing'], partial)).toBe(false);
    expect(actions.createOrder(pedId, partial).ok).toBe(false);
    const orderId = value(
      actions.createOrder(pedId, {
        extrusion: { machineId: 'mc-ext02', operatorIds: ['u-op1'] },
        printing: { machineId: 'mc-imp01', operatorIds: ['u-op1'] },
        sealing: { machineId: 'mc-sel02', operatorIds: ['u-op2'] },
        packing: { operatorIds: ['u-op2'] },
      }),
    );
    const order = () => db().orders.find((o) => o.id === orderId)!;
    expect(order()).toMatchObject({ status: 'pending', weightKg: 125, recipeId: 'r-fi4060-v2' });
    expect(db().stages.filter((s) => s.orderId === orderId).map((s) => s.type)).toEqual(['extrusion', 'printing', 'sealing', 'packing']);

    // Flow 4 - plant
    loginAs('operario1');
    const ext = `${orderId}-ext`;
    const entry = value(actions.startOperation(ext, 'u-op1'));
    expect(order().status).toBe('inProgress');
    expect(actions.startOperation(`${orderId}-imp`, 'u-op1')).toMatchObject({ ok: false }); // one timer per operator
    actions.pauseOperation(entry, 'active');
    actions.resumeOperation(entry);
    expect(actions.recordProduction(ext, 'u-op1', { rawMaterialKg: 100, rollKg: 120 })).toMatchObject({ ok: false });
    value(actions.recordProduction(ext, 'u-op1', { rawMaterialKg: 128, rollKg: 125 }));
    expect(actions.recordWaste(ext, 'u-op1', 2, undefined)).toMatchObject({ ok: false, errors: { destination: 'Seleccione el destino de la merma' } });
    expect(value(actions.recordWaste(ext, 'u-op1', 3, 'ground')).alert).toBe(false);
    actions.finishOperation(entry);
    expect(db().stages.find((s) => s.id === ext)!.status).toBe('done');

    for (const [stage, op, units] of [['imp', 'u-op1', 10_050], ['sel', 'u-op2', 10_020]] as const) {
      const e = value(actions.startOperation(`${orderId}-${stage}`, op));
      value(actions.recordProduction(`${orderId}-${stage}`, op, { units }));
      actions.finishOperation(e);
    }
    loginAs('operario2');
    value(actions.startOperation(`${orderId}-emp`, 'u-op2'));
    expect(actions.closeAtPacking(orderId, 'u-op2', 9_950, 0).ok).toBe(false);
    value(actions.closeAtPacking(orderId, 'u-op2', 9_950, 10));
    expect(order().status).toBe('toValidate');
    expect(db().timeEntries.some((t) => t.operatorId === 'u-op2' && !t.end)).toBe(false);

    // Flow 5 - supervision: return, close again, validate
    loginAs('supervisor');
    expect(actions.returnOrder(orderId, '').ok).toBe(false);
    value(actions.returnOrder(orderId, 'Revisar conteo'));
    expect(order().status).toBe('inProgress');
    expect(db().notifications.some((n) => n.userId === 'u-op2' && n.message.includes('Revisar conteo'))).toBe(true);
    value(actions.closeAtPacking(orderId, 'u-op2', 9_960, 10));
    const cost = value(actions.validateOrder(orderId));
    expect(order().status).toBe('closed');
    expect(cost.units).toBe(9_960);
    expect(cost.materials).toBeGreaterThan(0);
    expect(db().orderCosts.find((c) => c.orderId === orderId)).toEqual(cost);
    expect(actions.validateOrder(orderId).ok).toBe(false);

    // Flow 6 - pricing
    loginAs('ventas');
    const proposalId = value(actions.proposePrice({ productId: 'p-fi4060', baseUnitCost: cost.unitCost, margin: 0.1, method: 'onCost', price: cost.unitCost * 1.1 }));
    loginAs('admin');
    expect(actions.approveProposal(proposalId, '')).toMatchObject({ ok: false });
    value(actions.approveProposal(proposalId, 'Cliente estratégico'));
    expect(currentReferencePrice(db().priceProposals, 'p-fi4060')!.id).toBe(proposalId);
  });

  it('waste over the threshold notifies the supervisor (RF-17)', () => {
    loginAs('operario1');
    const stage = 'op-0005-ext';
    const e = value(actions.startOperation(stage, 'u-op1'));
    value(actions.recordProduction(stage, 'u-op1', { rawMaterialKg: 100, rollKg: 96 }));
    expect(value(actions.recordWaste(stage, 'u-op1', 3.6, 'pelletized')).alert).toBe(true);
    actions.finishOperation(e);
    expect(orderWaste(db(), 'op-0005').alert).toBe(true);
    expect(db().notifications.filter((n) => n.userId === 'u-supervisor' && n.orderId === 'op-0005')).toHaveLength(1);
  });

  it('time corrections require a reason and are audited (RF-22)', () => {
    loginAs('supervisor');
    const entry = db().timeEntries.find((t) => t.stageId === 'op-0003-sel')!;
    expect(actions.correctTimeEntry(entry.id, entry.start, entry.end!, '').ok).toBe(false);
    const newEnd = new Date(new Date(entry.end!).getTime() - 15 * 60_000).toISOString();
    value(actions.correctTimeEntry(entry.id, entry.start, newEnd, 'Olvidó marcar la salida'));
    expect(db().auditLog.at(-1)).toMatchObject({ entity: 'Marcación', userId: 'u-supervisor' });
  });
});

describe('flow 7: CSV export of approved costs and prices (W-20b)', () => {
  it('exports the selected products in the own CSV format and records it', () => {
    loginAs('admin');
    expect(actions.exportApprovedPrices([]).ok).toBe(false);
    const { csv, fileName } = value(actions.exportApprovedPrices(['p-fv1520']));
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('codigo,producto,costo_unitario,precio,cotizacion,fecha');
    // COT-0097: 355,00 USD / 25.000 = 0,0142; × 1,23 = 0,0175
    expect(lines[1]).toMatch(/^FV-1520,Funda de vivero 15x20,0\.0142,0\.0175,COT-0097,\d{4}-\d{2}-\d{2}$/);
    expect(fileName).toMatch(/^costos_precios_\d{8}\.csv$/);
    expect(db().dobraExports).toHaveLength(2);
    expect(db().auditLog.at(-1)).toMatchObject({ entity: 'Exportación', action: 'Exportó', after: '1 producto' });
  });
});
