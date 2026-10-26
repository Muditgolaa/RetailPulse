// Checkout against the seeded database. Uses a temporary stock level for one product at FAR01 and removes
// every order it creates, so the demo data is unchanged afterwards.
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const { app } = await import("../src/app.js");
const { prisma } = await import("../src/db.js");
const { signToken } = await import("../src/auth/jwt.js");
const { deliveryFee } = await import("../src/orders/service.js");

const FAR01 = 4;
const SKU = "P510"; // Lenovo laptop backpack, ₹1,999
const startedAt = new Date();
const tokens: Record<"gold" | "standard" | "manager", string> = { gold: "", standard: "", manager: "" };
let productId = 0;
let original: { onHand: number; reserved: number; version: number } = { onHand: 0, reserved: 0, version: 0 };
let arjunBefore = { id: 0, membershipTier: "STANDARD" as "STANDARD" | "SILVER" | "GOLD" | "PLATINUM" }; // orders here can earn Arjun a tier

const post = (who: keyof typeof tokens | null, url: string, body?: object) => {
  const req = request(app).post(url).send(body ?? {});
  return who ? req.set("Authorization", `Bearer ${tokens[who]}`) : req;
};
const get = (who: keyof typeof tokens | null, url: string) => {
  const req = request(app).get(url);
  return who ? req.set("Authorization", `Bearer ${tokens[who]}`) : req;
};
const order = (qty: number, extra: object = {}) => ({ storeId: FAR01, fulfilment: "DELIVERY", items: [{ sku: SKU, qty }], ...extra });
const stock = () => prisma.inventory.findUniqueOrThrow({ where: { storeId_productId: { storeId: FAR01, productId } } });
const setStock = (onHand: number) => prisma.inventory.update({ where: { storeId_productId: { storeId: FAR01, productId } }, data: { onHand, reserved: 0 } });

beforeAll(async () => {
  const [priya, arjun, rahul, product] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "priya@novamart.test" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "arjun@novamart.test" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "rahul@novamart.test" } }),
    prisma.product.findUniqueOrThrow({ where: { sku: SKU } }),
  ]);
  tokens.gold = signToken(priya.id);
  tokens.standard = signToken(arjun.id);
  arjunBefore = { id: arjun.id, membershipTier: arjun.membershipTier };
  tokens.manager = signToken(rahul.id);
  productId = product.id;
  original = await stock();
});

beforeEach(() => setStock(5));

afterAll(async () => {
  await prisma.order.deleteMany({ where: { createdAt: { gte: startedAt } } });
  await prisma.auditLog.deleteMany({ where: { createdAt: { gte: startedAt }, action: { in: ["ORDER_PLACED", "ORDER_CANCELLED", "MEMBERSHIP_UPGRADED"] } } });
  await prisma.user.update({ where: { id: arjunBefore.id }, data: { membershipTier: arjunBefore.membershipTier } });
  await prisma.inventory.update({ where: { storeId_productId: { storeId: FAR01, productId } }, data: original });
  await prisma.$disconnect();
});

describe("POST /api/orders", () => {
  it("creates the order with database prices, reserves stock and audits it", async () => {
    const res = await post("standard", "/api/orders", order(2));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: "PLACED", paymentStatus: "PAID", fulfilment: "DELIVERY", subtotal: 3998, deliveryFee: 0, total: 3998 });
    expect(res.body.code).toMatch(/^ORD-\d+$/);
    expect(res.body.items).toEqual([expect.objectContaining({ sku: SKU, qty: 2, unitPrice: 1999 })]);
    expect(res.body.expectedDeliveryAt).toEqual(expect.any(String));
    expect((await stock()).reserved).toBe(2);
    expect(await prisma.auditLog.count({ where: { action: "ORDER_PLACED", entityId: res.body.code } })).toBe(1);
  });

  it("rejects prices, totals or user ids sent by the client", async () => {
    for (const extra of [{ total: 1 }, { userId: 1 }, { items: [{ sku: SKU, qty: 1, price: 1 }] }]) {
      expect((await post("standard", "/api/orders", order(1, extra))).status).toBe(400);
    }
    expect((await stock()).reserved).toBe(0);
  });

  it("returns 409 when the store doesn't have enough, and reserves nothing", async () => {
    const res = await post("standard", "/api/orders", order(6));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/only 5 available at FAR01/);
    expect((await stock()).reserved).toBe(0);
  });

  it("rolls back the whole order when one line is short", async () => {
    const res = await post("standard", "/api/orders", { storeId: FAR01, fulfilment: "PICKUP", items: [{ sku: "P509", qty: 1 }, { sku: SKU, qty: 9 }] });
    expect(res.status).toBe(409);
    const router = await prisma.inventory.findFirstOrThrow({ where: { storeId: FAR01, product: { sku: "P509" } } });
    expect(router.reserved).toBe(0);
  });

  it("sells the last units exactly once when customers order at the same time", async () => {
    await setStock(1);
    const results = await Promise.all([post("standard", "/api/orders", order(1)), post("gold", "/api/orders", order(1)), post("standard", "/api/orders", order(1))]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    const s = await stock();
    expect(s.reserved).toBe(1);
    expect(s.onHand - s.reserved).toBe(0);
  });

  it.each([
    [{ storeId: 999, fulfilment: "DELIVERY", items: [{ sku: SKU, qty: 1 }] }, "unknown store"],
    [order(1, { items: [{ sku: "P999", qty: 1 }] }), "unknown product"],
    [order(1, { items: [] }), "empty cart"],
    [order(11), "quantity over 10"],
    [order(1, { items: [{ sku: SKU, qty: 1 }, { sku: SKU, qty: 2 }] }), "duplicate product"],
    [order(1, { fulfilment: "DRONE" }), "unknown fulfilment"],
  ])("returns 400 for %j (%s)", async (body) => {
    expect((await post("standard", "/api/orders", body)).status).toBe(400);
  });

  it("requires a signed-in customer", async () => {
    expect((await post(null, "/api/orders", order(1))).status).toBe(401);
    expect((await post("manager", "/api/orders", order(1))).status).toBe(403);
  });
});

describe("delivery fee", () => {
  it("follows the shipping and membership policies", () => {
    expect(deliveryFee(500, "DELIVERY", "STANDARD")).toBe(49);
    expect(deliveryFee(999, "DELIVERY", "STANDARD")).toBe(0);
    expect(deliveryFee(500, "DELIVERY", "GOLD")).toBe(0);
    expect(deliveryFee(500, "PICKUP", "STANDARD")).toBe(0);
  });
});

describe("reading orders", () => {
  it("lists only the customer's own orders, newest first", async () => {
    const placed = await post("gold", "/api/orders", order(1));
    const res = await get("gold", "/api/orders");
    expect(res.status).toBe(200);
    expect(res.body[0].code).toBe(placed.body.code);
    expect(res.body.map((o: { code: string }) => o.code)).toEqual(expect.arrayContaining(["ORD-1021", "ORD-1022", "ORD-1023"]));
    expect(res.body.map((o: { code: string }) => o.code)).not.toContain("ORD-1024"); // Arjun's
  });

  it("returns 404 for someone else's order", async () => {
    expect((await get("standard", "/api/orders/ORD-1023")).status).toBe(404);
    expect((await get("gold", "/api/orders/ORD-1023")).body).toMatchObject({ code: "ORD-1023", status: "DELAYED" });
    expect((await get("gold", "/api/orders/not-a-code")).status).toBe(400);
  });
});

describe("POST /api/orders/:code/cancel", () => {
  it("cancels once, refunds and releases the reserved stock", async () => {
    const placed = await post("standard", "/api/orders", order(3));
    expect((await stock()).reserved).toBe(3);

    const res = await post("standard", `/api/orders/${placed.body.code}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "CANCELLED", paymentStatus: "REFUNDED" });
    expect((await stock()).reserved).toBe(0);

    expect((await post("standard", `/api/orders/${placed.body.code}/cancel`)).status).toBe(409);
    expect((await stock()).reserved).toBe(0);
  });

  it("refuses delivered orders and other customers' orders", async () => {
    expect((await post("gold", "/api/orders/ORD-1021/cancel")).status).toBe(409); // delivered
    expect((await post("standard", "/api/orders/ORD-1021/cancel")).status).toBe(404); // not Arjun's
  });
});
