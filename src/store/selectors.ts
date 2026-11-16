// Read helpers that join the flat tables for screens.
import { dateKey, referenceQuote } from '@/domain/prices';
import { lineEconomics } from '@/domain/pricing';
import { orderWaste } from '@/domain/production';
import { buildRoute } from '@/domain/routing';
import type { Database, OrderStage, Role } from '@/domain/types';
import { formatNumber, formatPercent, formatRelative } from '@/format';

export function orderInfo(db: Database, orderId: string) {
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) return undefined;
  const salesOrder = db.salesOrders.find((s) => s.id === order.salesOrderId)!;
  const product = db.products.find((p) => p.id === salesOrder.productId)!;
  const customer = db.customers.find((c) => c.id === salesOrder.customerId)!;
  const recipe = db.recipes.find((r) => r.id === order.recipeId)!;
  const stages = db.stages.filter((s) => s.orderId === orderId).sort((a, b) => a.sequence - b.sequence);
  return { order, salesOrder, product, customer, recipe, stages, route: buildRoute(product.type) };
}

export function stageInfo(db: Database, stageId: string) {
  const stage = db.stages.find((s) => s.id === stageId);
  if (!stage) return undefined;
  const info = orderInfo(db, stage.orderId)!;
  const machine = db.machines.find((m) => m.id === stage.machineId);
  return { ...info, stage, machine };
}

/** Goal of a stage: extrusion works by weight, the rest by units (RF-14, RF-15). */
export function stageGoal(db: Database, stage: OrderStage): { value: number; unit: 'kg' | 'u' } {
  const info = orderInfo(db, stage.orderId)!;
  return stage.type === 'extrusion' ? { value: info.order.weightKg, unit: 'kg' } : { value: info.salesOrder.quantity, unit: 'u' };
}

/** Stages assigned to an operator in released orders, sorted by delivery date (RF-14). */
export function operatorStages(db: Database, userId: string) {
  return db.stages
    .filter((s) => s.operatorIds.includes(userId) && s.status !== 'done')
    .map((s) => stageInfo(db, s.id)!)
    .filter((i) => i.order.status === 'pending' || i.order.status === 'inProgress')
    .sort((a, b) => a.salesOrder.dueDate.localeCompare(b.salesOrder.dueDate) || a.stage.sequence - b.stage.sequence);
}

export const runningEntry = (db: Database, userId: string) => db.timeEntries.find((t) => t.operatorId === userId && !t.end);

export const userName = (db: Database, userId?: string) => db.users.find((u) => u.id === userId)?.name ?? '—';
export const machineCode = (db: Database, machineId?: string) => db.machines.find((m) => m.id === machineId)?.code ?? '—';

// ---- W-01 and the header bell: what needs the user's attention today ----

export type AttentionTone = 'warning' | 'info' | 'neutral' | 'success' | 'alert';

export interface AttentionItem {
  id: string;
  tag: string;
  tone: AttentionTone;
  title: string;
  detail: string;
  path: string;
}

const productCodeOf = (db: Database, productId: string) => db.products.find((p) => p.id === productId)?.code ?? '—';

/** Price rises of reference suppliers registered in the last 7 days (W-01 «Precio»). */
export function recentPriceRises(db: Database, now: Date = new Date()) {
  const since = dateKey(new Date(now.getTime() - 7 * 86_400_000).toISOString());
  const at = now.toISOString();
  return db.materials.flatMap((m) => {
    const ref = referenceQuote(db.supplierPrices, db.suppliers, m.id, at, db.referencePrices);
    if (!ref || ref.price.validFrom < since) return [];
    const history = db.supplierPrices
      .filter((p) => p.materialId === m.id && p.supplierId === ref.supplier.id && p.validFrom < ref.price.validFrom)
      .sort((a, b) => a.validFrom.localeCompare(b.validFrom));
    const previous = history.pop();
    return previous && ref.price.price > previous.price ? [{ material: m, supplier: ref.supplier, price: ref.price, previous }] : [];
  });
}

/** Last production or time record of the plant (W-01 «Último registro»). */
export function lastPlantRecord(db: Database): string | undefined {
  const times = [...db.productionRecords.map((r) => r.at), ...db.timeEntries.map((t) => t.end ?? t.start)];
  return times.sort().pop();
}

export function attentionItems(db: Database, role: Role, now: Date = new Date()): AttentionItem[] {
  const items: AttentionItem[] = [];
  if (role === 'adm') {
    for (const q of db.quotes) {
      const e = q.exception;
      if (!e || e.status !== 'pending') continue;
      const line = q.lines.find((l) => l.id === e.lineId);
      items.push({
        id: `exc-${q.id}`,
        tag: 'Excepción',
        tone: 'warning',
        title: `${q.code} · ${productCodeOf(db, line?.productId ?? '')} al ${formatNumber(e.marginPct * 100)} % (mínimo ${formatNumber(e.minMargin * 100)} %)`,
        detail: `${userName(db, e.requestedBy)} · ${formatRelative(e.requestedAt, now)}`,
        path: '/excepciones',
      });
    }
  }
  if (role === 'ven') {
    for (const q of db.quotes) {
      const e = q.exception;
      if (!e || e.status === 'pending' || q.status === 'confirmed' || !e.decidedAt) continue;
      const authorized = e.status === 'authorized';
      items.push({
        id: `dec-${q.id}`,
        tag: authorized ? 'Autorizada' : 'Rechazada',
        tone: authorized ? 'success' : 'alert',
        title: authorized ? `${q.code} autorizada: ya puede confirmar el pedido` : `${q.code} rechazada: revise el porcentaje`,
        detail: `${userName(db, e.decidedBy)} · ${formatRelative(e.decidedAt, now)}`,
        path: `/cotizaciones/${q.id}`,
      });
    }
  }
  if (role === 'adm' || role === 'sup') {
    for (const o of db.orders.filter((x) => x.status === 'toValidate')) {
      items.push({
        id: `close-${o.id}`,
        tag: 'Cierre',
        tone: 'info',
        title: `${o.code} lista para validar`,
        detail: `${userName(db, o.createdBy)} · ${formatRelative(o.packedAt ?? o.createdAt, now)}`,
        path: `/seguimiento/${o.id}`,
      });
    }
    for (const o of db.orders.filter((x) => x.status === 'inProgress')) {
      const w = orderWaste(db, o.id);
      if (!w.alert) continue;
      items.push({
        id: `waste-${o.id}`,
        tag: 'Merma',
        tone: 'alert',
        title: `${o.code}: merma de ${formatPercent(w.fraction)} sobre el umbral de ${formatPercent(db.settings.maxWastePct)}`,
        detail: 'Revise el registro de la etapa',
        path: `/seguimiento/${o.id}`,
      });
    }
  }
  if (role === 'adm') {
    for (const r of recentPriceRises(db, now)) {
      items.push({
        id: `price-${r.price.id}`,
        tag: 'Precio',
        tone: 'neutral',
        title: `${r.material.code} ${r.supplier.origin === 'imported' ? 'importado' : 'local'} subió a ${formatNumber(r.price.price, 2)} USD/kg`,
        detail: 'Revise el precio de referencia',
        path: `/precios?material=${r.material.id}`,
      });
    }
  }
  return items;
}

// ---- W-20b: approved costs and prices that can be shared with Dobra (RF-51) ----

export interface ApprovedPrice {
  productId: string;
  code: string;
  name: string;
  unitCost: number;
  price: number;
  quote: string;
  date: string;
}

/** Latest confirmed or authorized quote line of each product. */
export function approvedPrices(db: Database): ApprovedPrice[] {
  const byProduct = new Map<string, ApprovedPrice>();
  const quotes = db.quotes.filter((q) => q.status === 'confirmed' || q.status === 'authorized').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const q of quotes) {
    for (const line of q.lines) {
      const product = db.products.find((p) => p.id === line.productId);
      if (!product) continue;
      const e = lineEconomics(line);
      byProduct.set(product.id, { productId: product.id, code: product.code, name: product.name, unitCost: e.unitCost, price: e.price, quote: q.code, date: dateKey(q.exception?.decidedAt ?? q.createdAt) });
    }
  }
  return [...byProduct.values()].sort((a, b) => a.code.localeCompare(b.code));
}
