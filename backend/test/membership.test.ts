// Membership tiers earned from spend. Uses temporary customers and a temporary stock level for one product
// at FAR01, and removes everything it creates, so the demo data is unchanged afterwards.
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { app } = await import("../src/app.js");
const { prisma } = await import("../src/db.js");
const { signToken } = await import("../src/auth/jwt.js");
const { tierForSpend } = await import("../src/users/membership.js");

const FAR01 = 4;
const SKU = "P510"; // Lenovo laptop backpack, ₹1,999
const startedAt = new Date();
const userIds: number[] = [];
let productId = 0;
let originalStock = { onHand: 0, reserved: 0, version: 0 };

async function customer(tier: "STANDARD" | "GOLD") {
  const user = await prisma.user.create({
    data: { email: `member-${tier.toLowerCase()}-${Date.now()}@novamart.test`, name: "Test Member", passwordHash: "x", role: "CUSTOMER", membershipTier: tier, country: "IN" },
  });
  userIds.push(user.id);
  return { id: user.id, token: signToken(user.id) };
}

// A past order written straight to the database, to give a customer spend history.
let seq = 0;
const pastOrder = (userId: number, total: number, daysAgo: number, status: "DELIVERED" | "CANCELLED" = "DELIVERED") =>
  prisma.order.create({
    data: {
      code: `T${Date.now() % 1e8}${seq++}`, userId, storeId: FAR01, fulfilment: "PICKUP", status, paymentStatus: "PAID",
      subtotal: total, deliveryFee: 0, total, createdAt: new Date(Date.now() - daysAgo * 86_400_000),
    },
  });

const buy = (token: string) =>
  request(app).post("/api/orders").set("Authorization", `Bearer ${token}`).send({ storeId: FAR01, fulfilment: "PICKUP", items: [{ sku: SKU, qty: 1 }] });
const summary = (token: string) => request(app).get("/api/me/membership").set("Authorization", `Bearer ${token}`);
const tierOf = async (id: number) => (await prisma.user.findUniqueOrThrow({ where: { id } })).membershipTier;

beforeAll(async () => {
  productId = (await prisma.product.findUniqueOrThrow({ where: { sku: SKU } })).id;
  const where = { storeId_productId: { storeId: FAR01, productId } };
  originalStock = await prisma.inventory.findUniqueOrThrow({ where });
  await prisma.inventory.update({ where, data: { onHand: 20, reserved: 0 } });
});

afterAll(async () => {
  await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.auditLog.deleteMany({ where: { createdAt: { gte: startedAt }, actorId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.inventory.update({ where: { storeId_productId: { storeId: FAR01, productId } }, data: originalStock });
  await prisma.$disconnect();
});

describe("tierForSpend", () => {
  it("follows the policy thresholds", () => {
    expect(tierForSpend(0)).toBe("STANDARD");
    expect(tierForSpend(24_999)).toBe("STANDARD");
    expect(tierForSpend(25_000)).toBe("SILVER");
    expect(tierForSpend(75_000)).toBe("GOLD");
    expect(tierForSpend(200_000)).toBe("PLATINUM");
  });
});

describe("GET /api/me/membership", () => {
  it("needs a signed-in user", async () => {
    expect((await request(app).get("/api/me/membership")).status).toBe(401);
  });

  it("shows the tier, spend, what the next tier needs and every tier's benefits", async () => {
    const member = await customer("STANDARD");
    await pastOrder(member.id, 20_000, 30);
    await pastOrder(member.id, 9_000, 10, "CANCELLED"); // cancelled orders don't count
    await pastOrder(member.id, 50_000, 400); // older than 12 months

    const res = await summary(member.token);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ tier: "STANDARD", spentLast12Months: 20_000, next: { tier: "SILVER", minSpend: 25_000, remaining: 5_000 } });
    expect(res.body.tiers.map((t: { tier: string }) => t.tier)).toEqual(["STANDARD", "SILVER", "GOLD", "PLATINUM"]);
    expect(res.body.tiers.every((t: { benefits: string[] }) => t.benefits.length > 0)).toBe(true);
  });
});

describe("earning a tier at checkout", () => {
  it("upgrades the customer when an order crosses a threshold, and audits it", async () => {
    const member = await customer("STANDARD");
    await pastOrder(member.id, 24_000, 30);

    const res = await buy(member.token);
    expect(res.status).toBe(201);
    expect(res.body.membershipUpgrade).toEqual({ from: "STANDARD", to: "SILVER" });
    expect(res.body.deliveryFee).toBe(0);
    expect(await tierOf(member.id)).toBe("SILVER");
    expect(await prisma.auditLog.count({ where: { action: "MEMBERSHIP_UPGRADED", entityId: String(member.id) } })).toBe(1);

    // Already Silver: the next order changes nothing.
    expect((await buy(member.token)).body.membershipUpgrade).toBeNull();
  });

  it("stays put below the next threshold", async () => {
    const member = await customer("STANDARD");
    const res = await buy(member.token);
    expect(res.body.membershipUpgrade).toBeNull();
    expect(await tierOf(member.id)).toBe("STANDARD");
  });

  it("applies a tier already earned from earlier orders when the summary is opened", async () => {
    const member = await customer("STANDARD");
    await pastOrder(member.id, 80_000, 60);
    expect((await summary(member.token)).body).toMatchObject({ tier: "GOLD", next: { tier: "PLATINUM", remaining: 120_000 } });
    expect(await tierOf(member.id)).toBe("GOLD");
  });

  it("never lowers a tier the customer already has", async () => {
    const member = await customer("GOLD");
    expect((await buy(member.token)).body.membershipUpgrade).toBeNull();
    expect(await tierOf(member.id)).toBe("GOLD");
    expect((await summary(member.token)).body).toMatchObject({ tier: "GOLD", next: { tier: "PLATINUM" } });
  });
});
