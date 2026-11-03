// Read helpers that join the flat tables for screens.
import { buildRoute } from '@/domain/routing';
import type { Database, OrderStage } from '@/domain/types';

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
