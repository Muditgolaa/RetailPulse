// Repeatable demo seed: empties the business tables and reloads the same fictional data every run.
// knowledge_chunks is left alone because the ingestion step owns it.
// Run with `npm run db:seed` (never runs automatically).
import bcrypt from "bcryptjs";
import { prisma } from "../src/db.js";
import { Prisma } from "../src/generated/prisma/client.js";
import {
  categoryRules, inventoryOverrides, products, SALES_DAYS, salesOverrides, stores, type StoreCode,
} from "./seed-data.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const today = new Date(new Date().toISOString().slice(0, 10)); // midnight UTC
const daysAgo = (n: number) => new Date(today.getTime() - n * DAY_MS);

// Small deterministic hash so "random-looking" quantities are identical on every run.
const hash = (...nums: number[]) => nums.reduce((h, n) => (h * 31 + n * 7919) % 104729, 17);

function demoPassword(): string {
  const pw = process.env.SEED_DEMO_PASSWORD;
  if (!pw || pw.length < 8) {
    throw new Error("Set SEED_DEMO_PASSWORD (8+ characters) in backend/.env before seeding.");
  }
  return pw;
}

async function clearTables() {
  await prisma.$executeRaw`
    TRUNCATE TABLE app_settings, support_tickets, order_items, orders, cart_items, carts, sales_daily, inventory,
      agent_actions, audit_logs, ai_call_logs, users, products, stores
    RESTART IDENTITY CASCADE`;
}

async function seedStores() {
  await prisma.store.createMany({ data: stores.map((s) => ({ ...s })) });
  const rows = await prisma.store.findMany();
  return Object.fromEntries(rows.map((s) => [s.code, s.id])) as Record<StoreCode, number>;
}

async function seedProducts() {
  await prisma.product.createMany({
    data: products.map((p) => ({
      ...p,
      price: new Prisma.Decimal(p.price),
      cost: new Prisma.Decimal(Math.round(p.price * 0.8)),
      rating: new Prisma.Decimal(p.rating),
      description: `${p.name} from ${p.brand}, in our ${p.category} range.`,
    })),
  });
  const rows = await prisma.product.findMany();
  return Object.fromEntries(rows.map((p) => [p.sku, p.id])) as Record<string, number>;
}

async function seedInventoryAndSales(storeIds: Record<StoreCode, number>, productIds: Record<string, number>) {
  const inventory: Prisma.InventoryCreateManyInput[] = [];
  const sales: Prisma.SaleCreateManyInput[] = [];

  products.forEach((p, pi) => {
    const rule = categoryRules[p.category];
    stores.forEach((s, si) => {
      const o = inventoryOverrides[p.sku]?.[s.code];
      const reorderPoint = o?.reorderPoint ?? rule.reorderPoint;
      inventory.push({
        storeId: storeIds[s.code],
        productId: productIds[p.sku],
        // Healthy default: always well above the reorder point.
        onHand: o?.onHand ?? reorderPoint * 3 + (hash(pi, si) % (reorderPoint * 2)),
        incomingQty: o?.incomingQty ?? 0,
        reorderPoint,
        safetyStock: o?.safetyStock ?? rule.safetyStock,
        leadTimeDays: o?.leadTimeDays ?? rule.leadTimeDays,
      });

      const fixed = salesOverrides[p.sku]?.[s.code];
      for (let d = 0; d < SALES_DAYS; d++) {
        const qty = fixed ? fixed[d] : Math.max(0, rule.dailySales + (hash(pi, si, d) % 3) - 1);
        if (qty > 0) {
          sales.push({ storeId: storeIds[s.code], productId: productIds[p.sku], saleDate: daysAgo(SALES_DAYS - d), qty });
        }
      }
    });
  });

  await prisma.inventory.createMany({ data: inventory });
  await prisma.sale.createMany({ data: sales });
}

async function seedUsers(storeIds: Record<StoreCode, number>) {
  const passwordHash = await bcrypt.hash(demoPassword(), 10);
  const users = [
    { email: "priya@novamart.test", name: "Priya Sharma", role: "CUSTOMER", membershipTier: "GOLD", preferredStoreId: storeIds.DEL01,
      preferences: { brands: ["ASUS", "Lenovo"], maxBudget: 80000 } },
    { email: "arjun@novamart.test", name: "Arjun Mehta", role: "CUSTOMER", membershipTier: "STANDARD", preferredStoreId: storeIds.NOIDA01,
      preferences: { brands: [], maxBudget: 30000 } },
    { email: "rahul@novamart.test", name: "Rahul Verma", role: "MANAGER", membershipTier: "STANDARD", preferredStoreId: storeIds.DEL01,
      preferences: {} },
  ] as const;

  const ids: Record<string, number> = {};
  for (const u of users) {
    const row = await prisma.user.create({ data: { ...u, preferences: { ...u.preferences }, passwordHash, country: "IN" } });
    ids[u.email] = row.id;
  }
  return ids;
}

type OrderSeed = {
  code: string; email: string; store: StoreCode; fulfilment: "PICKUP" | "DELIVERY";
  status: "PLACED" | "READY_FOR_PICKUP" | "DELAYED" | "DELIVERED"; createdDaysAgo: number;
  expectedInDays?: number; deliveredDaysAgo?: number; statusNote?: string; items: [string, number][];
};

const orders: OrderSeed[] = [
  { code: "ORD-1021", email: "priya@novamart.test", store: "DEL01", fulfilment: "DELIVERY", status: "DELIVERED",
    createdDaysAgo: 20, expectedInDays: -17, deliveredDaysAgo: 17, items: [["P501", 1], ["P504", 1]] },
  { code: "ORD-1022", email: "priya@novamart.test", store: "GGN01", fulfilment: "PICKUP", status: "READY_FOR_PICKUP",
    createdDaysAgo: 2, items: [["P405", 1]] },
  // The delayed order used by the support-agent demo ("Where is my order ORD-1023?").
  { code: "ORD-1023", email: "priya@novamart.test", store: "DEL01", fulfilment: "DELIVERY", status: "DELAYED",
    createdDaysAgo: 6, expectedInDays: -3, statusNote: "Courier delay at the Delhi sorting hub; new date not confirmed",
    items: [["P302", 1]] },
  // Arjun has spent ₹23,999, ₹1,001 short of Silver, so his next order shows a membership upgrade.
  { code: "ORD-1024", email: "arjun@novamart.test", store: "NOIDA01", fulfilment: "DELIVERY", status: "PLACED",
    createdDaysAgo: 0, expectedInDays: 4, items: [["P205", 1]] },
];

async function seedOrders(userIds: Record<string, number>, storeIds: Record<StoreCode, number>, productIds: Record<string, number>) {
  const priceOf = Object.fromEntries(products.map((p) => [p.sku, p.price]));

  for (const o of orders) {
    const subtotal = o.items.reduce((sum, [sku, qty]) => sum + priceOf[sku] * qty, 0);
    const deliveryFee = o.fulfilment === "DELIVERY" && subtotal < 999 ? 49 : 0;
    await prisma.order.create({
      data: {
        code: o.code,
        userId: userIds[o.email],
        storeId: storeIds[o.store],
        fulfilment: o.fulfilment,
        status: o.status,
        paymentStatus: "PAID",
        statusNote: o.statusNote,
        subtotal: new Prisma.Decimal(subtotal),
        deliveryFee: new Prisma.Decimal(deliveryFee),
        total: new Prisma.Decimal(subtotal + deliveryFee),
        createdAt: daysAgo(o.createdDaysAgo),
        expectedDeliveryAt: o.expectedInDays === undefined ? null : daysAgo(-o.expectedInDays),
        deliveredAt: o.deliveredDaysAgo === undefined ? null : daysAgo(o.deliveredDaysAgo),
        items: {
          create: o.items.map(([sku, qty]) => ({ productId: productIds[sku], qty, unitPrice: new Prisma.Decimal(priceOf[sku]) })),
        },
      },
    });

    // Open orders hold stock at their store until fulfilled.
    if (o.status === "PLACED" || o.status === "READY_FOR_PICKUP") {
      for (const [sku, qty] of o.items) {
        await prisma.inventory.update({
          where: { storeId_productId: { storeId: storeIds[o.store], productId: productIds[sku] } },
          data: { reserved: { increment: qty } },
        });
      }
    }
  }
}

async function seedCarts(userIds: Record<string, number>, productIds: Record<string, number>) {
  await prisma.cart.create({
    data: { userId: userIds["priya@novamart.test"], items: { create: [{ productId: productIds.P502, qty: 1 }] } },
  });
  await prisma.cart.create({ data: { userId: userIds["arjun@novamart.test"] } });
}

async function main() {
  demoPassword(); // fail fast before deleting anything
  await clearTables();
  const storeIds = await seedStores();
  const productIds = await seedProducts();
  await seedInventoryAndSales(storeIds, productIds);
  const userIds = await seedUsers(storeIds);
  await seedOrders(userIds, storeIds, productIds);
  await seedCarts(userIds, productIds);
  console.log(`Seeded ${stores.length} stores, ${products.length} products, ${Object.keys(userIds).length} users, ${orders.length} orders.`);
}

try {
  await main();
} catch (err) {
  console.error("Seed failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
