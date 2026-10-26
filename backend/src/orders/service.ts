// Orders: prices come from the database, stock is reserved atomically, and everything happens in one transaction.
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../db.js";
import { HttpError } from "../lib/http.js";
import { applyEarnedTier } from "../users/membership.js";

export type Customer = { id: number; email: string; membershipTier: string };
export type OrderInput = { storeId: number; fulfilment: "PICKUP" | "DELIVERY"; items: { sku: string; qty: number }[] };

// Delivery rules from the Shipping and Membership policies (backend/knowledge).
export const FREE_DELIVERY_FROM = 999;
export const STANDARD_DELIVERY_FEE = 49;
const DELIVERY_DAYS = 3; // every NovaMart store is in Delhi NCR: 2–3 business days
const PAID_TIERS = ["SILVER", "GOLD", "PLATINUM"]; // free standard delivery on all orders

export function deliveryFee(subtotal: number, fulfilment: OrderInput["fulfilment"], tier: string): number {
  if (fulfilment === "PICKUP" || PAID_TIERS.includes(tier) || subtotal >= FREE_DELIVERY_FROM) return 0;
  return STANDARD_DELIVERY_FEE;
}

// Seeded orders are ORD-1021…1024 with ids 1…4, so codes continue that series.
const orderCode = (id: number) => `ORD-${1020 + id}`;

const orderInclude = {
  store: { select: { id: true, code: true, name: true } },
  items: { include: { product: { select: { sku: true, name: true, brand: true, category: true } } }, orderBy: { id: "asc" } },
} as const;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

// Decimal columns → numbers for JSON.
export function toOrderDto(o: OrderRow) {
  return {
    code: o.code, status: o.status, paymentStatus: o.paymentStatus, fulfilment: o.fulfilment, statusNote: o.statusNote,
    store: o.store, subtotal: Number(o.subtotal), deliveryFee: Number(o.deliveryFee), total: Number(o.total),
    expectedDeliveryAt: o.expectedDeliveryAt, deliveredAt: o.deliveredAt, createdAt: o.createdAt,
    items: o.items.map((i) => ({ sku: i.product.sku, name: i.product.name, brand: i.product.brand, category: i.product.category, qty: i.qty, unitPrice: Number(i.unitPrice) })),
  };
}

export async function placeOrder(input: OrderInput, customer: Customer) {
  const skus = input.items.map((i) => i.sku);
  const [store, products] = await Promise.all([
    prisma.store.findUnique({ where: { id: input.storeId } }),
    prisma.product.findMany({ where: { sku: { in: skus }, active: true } }),
  ]);
  if (!store) throw new HttpError(400, "Unknown store");
  const bySku = new Map(products.map((p) => [p.sku, p]));
  const missing = skus.filter((s) => !bySku.has(s));
  if (missing.length) throw new HttpError(400, `Unknown product: ${missing.join(", ")}`);

  const lines = input.items.map((i) => ({ product: bySku.get(i.sku)!, qty: i.qty }));
  const subtotal = lines.reduce((sum, l) => sum + Number(l.product.price) * l.qty, 0);
  const fee = deliveryFee(subtotal, input.fulfilment, customer.membershipTier);

  const { order, membershipUpgrade } = await prisma.$transaction(async (tx) => {
    // Reserve each line only if enough is available right now. The conditional UPDATE locks the row, so two
    // customers can't both take the last unit; any shortfall rolls back the whole order.
    for (const l of lines) {
      const reserved = await tx.$executeRaw`
        UPDATE inventory SET reserved = reserved + ${l.qty}, version = version + 1, "updatedAt" = now()
        WHERE "storeId" = ${store.id} AND "productId" = ${l.product.id} AND "onHand" - reserved >= ${l.qty}`;
      if (reserved === 0) {
        const row = await tx.inventory.findUnique({ where: { storeId_productId: { storeId: store.id, productId: l.product.id } } });
        const left = row ? Math.max(row.onHand - row.reserved, 0) : 0;
        throw new HttpError(409, `${l.product.name}: only ${left} available at ${store.code}`);
      }
    }

    const [{ id }] = await tx.$queryRaw<{ id: number }[]>`SELECT nextval(pg_get_serial_sequence('orders', 'id'))::int AS id`;
    const created = await tx.order.create({
      data: {
        id, code: orderCode(id), userId: customer.id, storeId: store.id, fulfilment: input.fulfilment,
        status: "PLACED", paymentStatus: "PAID", // payment is simulated
        statusNote: input.fulfilment === "PICKUP" ? "Ready for pickup within 2 hours" : null,
        subtotal: new Prisma.Decimal(subtotal), deliveryFee: new Prisma.Decimal(fee), total: new Prisma.Decimal(subtotal + fee),
        expectedDeliveryAt: input.fulfilment === "DELIVERY" ? new Date(Date.now() + DELIVERY_DAYS * 86_400_000) : null,
        items: { create: lines.map((l) => ({ productId: l.product.id, qty: l.qty, unitPrice: l.product.price })) },
      },
      include: orderInclude,
    });
    await tx.auditLog.create({
      data: {
        actorId: customer.id, actorEmail: customer.email, action: "ORDER_PLACED", entity: "order", entityId: created.code,
        details: { storeCode: store.code, total: subtotal + fee, items: input.items },
      },
    });
    // The new tier applies from the next order; this one was priced with the tier the customer had.
    return { order: created, membershipUpgrade: await applyEarnedTier(customer, tx) };
  });
  return { ...toOrderDto(order), membershipUpgrade };
}

export async function listOrders(userId: number) {
  const orders = await prisma.order.findMany({ where: { userId }, include: orderInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  return orders.map(toOrderDto);
}

// Another customer's order looks the same as a missing one, so codes can't be probed.
export async function getOrder(code: string, userId: number) {
  const order = await prisma.order.findFirst({ where: { code, userId }, include: orderInclude });
  if (!order) throw new HttpError(404, "Order not found");
  return toOrderDto(order);
}

// Cancellation policy: before it ships or is collected, or when it is delayed past its expected date.
const HOLDS_STOCK = ["PLACED", "READY_FOR_PICKUP"] as const;
const CANCELLABLE = [...HOLDS_STOCK, "DELAYED"] as const;

export async function cancelOrder(code: string, customer: Customer) {
  const order = await prisma.$transaction(async (tx) => {
    const existing = await tx.order.findFirst({ where: { code, userId: customer.id }, include: { items: true } });
    if (!existing) throw new HttpError(404, "Order not found");

    // Conditional update: only one cancellation can succeed.
    const { count } = await tx.order.updateMany({
      where: { id: existing.id, status: { in: [...CANCELLABLE] } },
      data: { status: "CANCELLED", paymentStatus: "REFUNDED", statusNote: "Cancelled by customer" },
    });
    if (count === 0) throw new HttpError(409, `An order that is ${existing.status.toLowerCase().replace(/_/g, " ")} can't be cancelled`);

    // Orders that were still waiting at the store give their reserved stock back.
    if ((HOLDS_STOCK as readonly string[]).includes(existing.status)) {
      for (const item of existing.items) {
        await tx.$executeRaw`
          UPDATE inventory SET reserved = GREATEST(reserved - ${item.qty}, 0), version = version + 1, "updatedAt" = now()
          WHERE "storeId" = ${existing.storeId} AND "productId" = ${item.productId}`;
      }
    }
    await tx.auditLog.create({
      data: { actorId: customer.id, actorEmail: customer.email, action: "ORDER_CANCELLED", entity: "order", entityId: code, details: { previousStatus: existing.status } },
    });
    return tx.order.findUniqueOrThrow({ where: { id: existing.id }, include: orderInclude });
  });
  return toOrderDto(order);
}
