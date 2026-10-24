// Inventory intelligence: deterministic assessment, PROPOSED actions from a scan, and manager decisions
// applied in one transaction with a conditional state change so a proposal can only be decided once.
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../db.js";
import { HttpError } from "../lib/http.js";
import { availability } from "../lib/stock.js";
import { assessStock, FORMULA, SALES_WINDOW_DAYS } from "./calculator.js";
import { explain } from "./explain.js";

export type Manager = { id: number; email: string };

const DAY_MS = 86_400_000;
const today = () => new Date(new Date().toISOString().slice(0, 10)); // UTC calendar day

// Stock rows for one store with the deterministic assessment. Demand = the last 14 full days of sales.
export async function assessStore(storeId: number) {
  const end = today();
  const start = new Date(end.getTime() - SALES_WINDOW_DAYS * DAY_MS);
  const [rows, sales] = await Promise.all([
    prisma.inventory.findMany({ where: { storeId }, include: { product: true }, orderBy: { productId: "asc" } }),
    prisma.sale.groupBy({ by: ["productId"], where: { storeId, saleDate: { gte: start, lt: end } }, _sum: { qty: true } }),
  ]);
  const sold = new Map(sales.map((s) => [s.productId, s._sum.qty ?? 0]));
  return rows.map((i) => {
    const unitsSoldInWindow = sold.get(i.productId) ?? 0;
    return { inventory: i, product: i.product, unitsSoldInWindow, assessment: assessStock({ ...i, unitsSoldInWindow }) };
  });
}

export async function dashboard(storeId: number) {
  const rows = await assessStore(storeId);
  const items = rows.map(({ inventory: i, product: p, assessment: a }) => ({
    productId: p.id, sku: p.sku, name: p.name, category: p.category,
    available: a.available, onHand: i.onHand, incomingQty: i.incomingQty, reorderPoint: i.reorderPoint,
    safetyStock: i.safetyStock, leadTimeDays: i.leadTimeDays, cost: Number(p.cost),
    avgDaily: a.avgDailySales, daysLeft: a.daysOfCover, severity: a.severity, suggestedQty: a.suggestedQty,
    status: availability(i).status,
  }));
  const count = (fn: (r: (typeof items)[number]) => boolean) => items.filter(fn).length;
  const pendingApprovals = await prisma.agentAction.count({ where: { storeId, status: "PROPOSED" } });
  return {
    kpis: {
      activeSkus: items.length,
      stockValue: items.reduce((sum, r) => sum + r.onHand * r.cost, 0),
      needsAttention: count((r) => r.severity !== "OK"),
      critical: count((r) => r.severity === "CRITICAL"),
      pendingApprovals,
    },
    health: { inStock: count((r) => r.status === "IN_STOCK"), low: count((r) => r.status === "LOW_STOCK"), out: count((r) => r.status === "OUT_OF_STOCK") },
    items,
  };
}

// Creates PROPOSED replenishment actions only. Never changes inventory.
export async function scanStore(storeId: number, manager: Manager) {
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
  const rows = (await assessStore(storeId)).filter((r) => r.assessment.needsReplenishment && r.assessment.suggestedQty > 0);
  const open = await prisma.agentAction.findMany({ where: { storeId, status: "PROPOSED" }, select: { productId: true } });
  const openIds = new Set(open.map((o) => o.productId));
  const fresh = rows.filter((r) => !openIds.has(r.product.id));

  const explanations = await explain(fresh.map((r) => ({ sku: r.product.sku, name: r.product.name, ...r.inventory, ...r.assessment, unitsSoldInWindow: r.unitsSoldInWindow })), manager.id);
  const day = today().toISOString().slice(0, 10);
  const created: number[] = [];
  const skipped = rows.filter((r) => openIds.has(r.product.id)).map((r) => ({ sku: r.product.sku, reason: "OPEN_PROPOSAL_EXISTS" }));

  for (const r of fresh) {
    const a = r.assessment;
    const ex = explanations.get(r.product.sku)!;
    try {
      const action = await prisma.agentAction.create({
        data: {
          agent: "INVENTORY", actionType: "REPLENISH", storeId, productId: r.product.id, status: "PROPOSED",
          idempotencyKey: `REPLENISH:${storeId}:${r.product.id}:${day}`,
          explanation: ex.text,
          payload: {
            onHand: r.inventory.onHand, reserved: r.inventory.reserved, incomingQty: r.inventory.incomingQty,
            available: a.available, inventoryPosition: a.inventoryPosition, reorderPoint: r.inventory.reorderPoint,
            safetyStock: r.inventory.safetyStock, leadTimeDays: r.inventory.leadTimeDays, unitsSoldInWindow: r.unitsSoldInWindow,
            salesWindowDays: SALES_WINDOW_DAYS, avgDailySales: a.avgDailySales, daysOfCover: a.daysOfCover,
            targetCoverageDays: a.targetCoverageDays, severity: a.severity, suggestedQty: a.suggestedQty, capped: a.capped,
            formula: FORMULA, explanationSource: ex.source,
          },
        },
      });
      created.push(action.id);
    } catch (err) {
      // Same item already proposed today (also covers two scans running at once).
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") skipped.push({ sku: r.product.sku, reason: "ALREADY_PROPOSED_TODAY" });
      else throw err;
    }
  }

  await prisma.auditLog.create({
    data: {
      actorId: manager.id, actorEmail: manager.email, action: "INVENTORY_SCAN", entity: "store", entityId: store.code,
      details: { itemsNeedingReplenishment: rows.length, createdActionIds: created, skipped },
    },
  });
  return { storeCode: store.code, scannedItems: (await prisma.inventory.count({ where: { storeId } })), created: await listActions({ ids: created }), skipped };
}

const actionInclude = {
  store: { select: { id: true, code: true, name: true } },
  product: { select: { id: true, sku: true, name: true } },
  decidedBy: { select: { id: true, name: true, email: true } },
} as const;

export function listActions(f: { status?: "PROPOSED" | "APPROVED" | "REJECTED" | "EXECUTED"; storeId?: number; ids?: number[] }) {
  return prisma.agentAction.findMany({
    where: { status: f.status, storeId: f.storeId, ...(f.ids && { id: { in: f.ids } }) },
    include: actionInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
  });
}

// Approve or reject exactly once. The conditional update (WHERE status = 'PROPOSED') holds a row lock, so a
// concurrent second decision waits, then matches no row and gets 409. Everything commits or rolls back together.
export async function decide(id: number, decision: "approve" | "reject", manager: Manager, note?: string) {
  return prisma.$transaction(async (tx) => {
    const action = await tx.agentAction.findUnique({ where: { id } });
    if (!action) throw new HttpError(404, "Action not found");

    const status = decision === "approve" ? "APPROVED" : "REJECTED";
    const { count } = await tx.agentAction.updateMany({
      where: { id, status: "PROPOSED" },
      data: { status, decidedById: manager.id, decidedAt: new Date() },
    });
    if (count === 0) {
      const current = await tx.agentAction.findUniqueOrThrow({ where: { id }, select: { status: true } });
      throw new HttpError(409, `This proposal was already ${current.status.toLowerCase()}`);
    }

    const qty = Number((action.payload as { suggestedQty?: unknown }).suggestedQty);
    let inventoryChange: Record<string, number> | null = null;
    if (decision === "approve") {
      if (!action.storeId || !action.productId || !Number.isInteger(qty) || qty <= 0) throw new HttpError(422, "Proposal has no valid quantity");
      const key = { storeId_productId: { storeId: action.storeId, productId: action.productId } };
      const before = await tx.inventory.findUniqueOrThrow({ where: key });
      // Approval places the supplier order: the units become incoming stock for this store.
      const after = await tx.inventory.update({ where: key, data: { incomingQty: { increment: qty }, version: { increment: 1 } } });
      inventoryChange = { orderedQty: qty, incomingBefore: before.incomingQty, incomingAfter: after.incomingQty, versionAfter: after.version };
    }

    await tx.auditLog.create({
      data: {
        actorId: manager.id, actorEmail: manager.email,
        action: decision === "approve" ? "REPLENISHMENT_APPROVED" : "REPLENISHMENT_REJECTED",
        entity: "agent_action", entityId: String(id),
        details: { storeId: action.storeId, productId: action.productId, suggestedQty: qty, note: note ?? null, inventoryChange },
      },
    });
    return tx.agentAction.findUniqueOrThrow({ where: { id }, include: actionInclude });
  });
}

export function listAudit(limit: number) {
  return prisma.auditLog.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit });
}
