// The 7 demo flows (AGENTS.md section 7) driven through the store actions.
import { currentReferencePrice } from '@/domain/pricing';
import { dateKey } from '@/domain/prices';
import { orderWaste } from '@/domain/production';
import { IMPORT_SAMPLE_WITH_ERRORS } from '@/domain/dobra';
import * as actions from './actions';
import { useDataStore } from './data';
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

describe('login (RF-01, RF-02)', () => {
  it('rejects wrong and inactive accounts with the same generic message', () => {
    expect(useSessionStore.getState().login('admin', 'x')).toEqual({ ok: false, error: 'Usuario o contraseña incorrectos' });
    expect(useSessionStore.getState().login('operario5', 'demo123')).toEqual({ ok: false, error: 'Usuario o contraseña incorrectos' });
    expect(useSessionStore.getState().login('ADMIN', 'demo123').ok).toBe(true);
  });
});

describe('flow 1: catalog setup', () => {
  it('creates a user, imports the catalog, defines and approves a recipe', () => {
    loginAs('admin');
    expect(actions.saveUser({ name: 'Nuevo', username: 'ventas', role: 'ven', active: true })).toMatchObject({ ok: false, errors: { username: 'Ese nombre de usuario ya existe' } });
    value(actions.saveUser({ name: 'María Prueba', username: 'mprueba', role: 'fac', active: true }));

    const imported = actions.importCatalog(IMPORT_SAMPLE_WITH_ERRORS);
    expect(imported.totalRows).toBe(10);
    expect(imported.materials.length + imported.products.length + imported.suppliers.length).toBe(7);
    expect(imported.rejected.map((r) => r.row)).toEqual([4, 8]);
    expect(imported.skipped.map((r) => r.row)).toEqual([5]);
    // importing again does not duplicate rows
    expect(actions.importCatalog(IMPORT_SAMPLE_WITH_ERRORS).skipped).toHaveLength(8);

    expect(actions.saveProduct({ code: 'FX-1', name: 'X', widthCm: 1, lengthCm: 1, gauge: 1, weightG: 0, type: 'natural', lineId: 'ln-com' })).toMatchObject({ ok: false });
    const draftId = value(actions.saveRecipeDraft('p-fn2030', [{ materialId: 'm-pebd', qtyPerKg: 0.8 }, { materialId: 'm-pead', qtyPerKg: 0.2 }]));
    expect(db().recipes.find((r) => r.id === draftId)).toMatchObject({ version: 2, status: 'draft' });
    actions.approveRecipe(draftId);
    expect(db().recipes.find((r) => r.id === draftId)!.status).toBe('approved');
    expect(db().auditLog.at(-1)).toMatchObject({ userId: 'u-admin', entity: 'Receta', action: 'Aprobación' });
    expect(actions.rejectRecipe('r-fb2636-v2', ' ')).toMatchObject({ ok: false, errors: { reason: 'Ingrese el motivo del rechazo' } });
  });
});

describe('flow 2: supplier prices and resource costs', () => {
  it('a new resin price changes the reference and is kept in history', () => {
    loginAs('contabilidad');
    expect(actions.saveSupplierPrice({ materialId: 'm-pebd', supplierId: 's-global', price: 1.3, validFrom: inDays(0) })).toMatchObject({
      ok: false,
      errors: { leadTimeDays: 'Un precio importado exige el plazo de llegada en días' },
    });
    value(actions.saveSupplierPrice({ materialId: 'm-pebd', supplierId: 's-polimeros', price: 1.58, validFrom: inDays(0) }));
    expect(useUiStore.getState().lastPriceChange).toMatchObject({ materialId: 'm-pebd', oldPrice: 1.5, newPrice: 1.58 });
    expect(db().supplierPrices.filter((p) => p.materialId === 'm-pebd' && p.supplierId === 's-polimeros')).toHaveLength(7);
  });
  it('resource rates reject negatives and keep the previous value', () => {
    loginAs('rrhh');
    expect(actions.savePositionRate('pos-ext', -1, inDays(0)).ok).toBe(false);
    value(actions.savePositionRate('pos-ext', 3.4, inDays(0)));
    expect(db().positionRates.filter((r) => r.positionId === 'pos-ext').map((r) => r.hourlyCost)).toEqual([3.1, 3.25, 3.4]);
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

describe('flow 7: export to Dobra', () => {
  it('exports only approved prices and records the export', () => {
    loginAs('contabilidad');
    const { csv } = value(actions.exportToDobra(['p-fn2030', 'p-fi4060']));
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('codigo,nombre,costo_unitario,precio_referencial,fecha');
    expect(lines[1]).toMatch(/^FN-2030,Funda natural 20x30,0\.\d{4},0\.0125,\d{4}-\d{2}-\d{2}$/);
    expect(db().dobraExports).toHaveLength(2);
  });
});
