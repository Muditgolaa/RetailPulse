// Inventory workflow against the seeded database. Uses two temporary low-stock fixtures at FAR01 so the
// DEL01 demo data stays untouched; everything is restored afterwards. Groq is mocked.
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.GROQ_API_KEY ||= "gsk_test_key_for_ops_tests_000000000000";
const { app } = await import("../src/app.js");
const { prisma } = await import("../src/db.js");
const { signToken } = await import("../src/auth/jwt.js");
const { assessStore } = await import("../src/inventory/service.js");

const FAR01 = 4;
const FIXTURES = ["P504", "P505"]; // SanDisk SSD, Dell monitor
const startedAt = new Date();
let manager = { id: 0, token: "" };
let customerToken = "";
let originals: { storeId: number; productId: number; onHand: number; reserved: number; incomingQty: number; reorderPoint: number; safetyStock: number; leadTimeDays: number; version: number }[] = [];
let productIds: Record<string, number> = {};

const realFetch = globalThis.fetch;
let groqCalls = 0;
function mockGroq(reply: unknown | "down") {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (!String(url).includes("api.groq.com")) return realFetch(url, init);
    groqCalls++;
    if (reply === "down") return new Response("{}", { status: 503 });
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) }, finish_reason: "stop" }] }), { status: 200 });
  }));
}

const as = (token: string | null, method: "get" | "post", url: string, body?: object) => {
  const req = method === "get" ? request(app).get(url) : request(app).post(url).send(body ?? {});
  return token ? req.set("Authorization", `Bearer ${token}`) : req;
};
const inventoryOf = (sku: string) => prisma.inventory.findUniqueOrThrow({ where: { storeId_productId: { storeId: FAR01, productId: productIds[sku] } } });
const scan = () => as(manager.token, "post", "/api/ops/scan", { storeId: FAR01 });
const proposalFor = async (sku: string) => prisma.agentAction.findFirstOrThrow({ where: { storeId: FAR01, productId: productIds[sku], status: "PROPOSED" } });

beforeAll(async () => {
  const [rahul, priya, products] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "rahul@novamart.test" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "priya@novamart.test" } }),
    prisma.product.findMany({ where: { sku: { in: FIXTURES } } }),
  ]);
  manager = { id: rahul.id, token: signToken(rahul.id) };
  customerToken = signToken(priya.id);
  productIds = Object.fromEntries(products.map((p) => [p.sku, p.id]));
  originals = await prisma.inventory.findMany({ where: { storeId: FAR01, productId: { in: Object.values(productIds) } } });

  await prisma.agentAction.deleteMany({ where: { storeId: FAR01 } });
  // Make both fixtures run low: 5 available, reorder point 15, lead time 3 days.
  await prisma.inventory.updateMany({
    where: { storeId: FAR01, productId: { in: Object.values(productIds) } },
    data: { onHand: 5, reserved: 0, incomingQty: 0, reorderPoint: 15, safetyStock: 8, leadTimeDays: 3 },
  });
  vi.spyOn(prisma.aiCallLog, "create").mockResolvedValue({} as never);
});

beforeEach(() => {
  vi.unstubAllGlobals();
  groqCalls = 0;
});

afterAll(async () => {
  await prisma.agentAction.deleteMany({ where: { storeId: FAR01 } });
  await prisma.auditLog.deleteMany({ where: { createdAt: { gte: startedAt }, actorId: manager.id } });
  for (const o of originals) {
    const { storeId, productId, ...data } = o;
    await prisma.inventory.update({ where: { storeId_productId: { storeId, productId } }, data });
  }
  await prisma.$disconnect();
});

describe("authorization", () => {
  const endpoints: ["get" | "post", string, object?][] = [
    ["get", "/api/ops/dashboard?storeId=4"],
    ["post", "/api/ops/scan", { storeId: 4 }],
    ["get", "/api/ops/actions"],
    ["post", "/api/ops/actions/1/approve"],
    ["post", "/api/ops/actions/1/reject"],
    ["get", "/api/ops/audit"],
  ];

  it.each(endpoints)("%s %s returns 401 without a token and 403 for a customer", async (method, url, body) => {
    expect((await as(null, method, url, body)).status).toBe(401);
    expect((await as(customerToken, method, url, body)).status).toBe(403);
  });
});

describe("scan", () => {
  it("creates PROPOSED actions with calculator quantities and never changes inventory", async () => {
    // The model tries to change the quantity; its text is rejected and the calculated number stays.
    mockGroq({ explanations: [{ sku: "P504", text: "Order 9999 units right away." }, { sku: "P505", text: "Stock lasts under the lead time." }] });
    const before = await Promise.all(FIXTURES.map(inventoryOf));
    const res = await scan();

    expect(res.status).toBe(201);
    expect(res.body.created.map((a: { product: { sku: string } }) => a.product.sku).sort()).toEqual(FIXTURES);
    expect(res.body.created.every((a: { status: string }) => a.status === "PROPOSED")).toBe(true);

    const expected = new Map((await assessStore(FAR01)).map((r) => [r.product.sku, r.assessment.suggestedQty]));
    for (const a of res.body.created) {
      expect(a.payload.suggestedQty).toBe(expected.get(a.product.sku));
      expect(a.payload.suggestedQty).toBeGreaterThan(0);
    }
    const p504 = res.body.created.find((a: { product: { sku: string } }) => a.product.sku === "P504");
    expect(p504.explanation).not.toContain("9999");
    expect(p504.payload.explanationSource).toBe("TEMPLATE");
    const p505 = res.body.created.find((a: { product: { sku: string } }) => a.product.sku === "P505");
    expect(p505.payload.explanationSource).toBe("AI");

    expect(await Promise.all(FIXTURES.map(inventoryOf))).toEqual(before);
  });

  it("does not create duplicates when scanned again", async () => {
    mockGroq({ explanations: [] });
    const res = await scan();
    expect(res.body.created).toEqual([]);
    expect(res.body.skipped.map((s: { reason: string }) => s.reason)).toEqual(["OPEN_PROPOSAL_EXISTS", "OPEN_PROPOSAL_EXISTS"]);
    expect(await prisma.agentAction.count({ where: { storeId: FAR01, status: "PROPOSED" } })).toBe(2);
  });

  it("lists open proposals", async () => {
    const res = await as(manager.token, "get", "/api/ops/actions?status=PROPOSED&storeId=4");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

describe("approve", () => {
  it("updates inventory, the action and the audit log in one transaction", async () => {
    const action = await proposalFor("P504");
    const qty = (action.payload as { suggestedQty: number }).suggestedQty;
    const before = await inventoryOf("P504");

    const res = await as(manager.token, "post", `/api/ops/actions/${action.id}/approve`, { note: "Supplier confirmed" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "APPROVED", decidedBy: { id: manager.id, email: "rahul@novamart.test" } });
    expect(res.body.decidedAt).toEqual(expect.any(String));

    const after = await inventoryOf("P504");
    expect(after.incomingQty).toBe(before.incomingQty + qty);
    expect(after.onHand).toBe(before.onHand);
    expect(after.version).toBe(before.version + 1);

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entity: "agent_action", entityId: String(action.id) } });
    expect(audit).toMatchObject({ action: "REPLENISHMENT_APPROVED", actorId: manager.id, actorEmail: "rahul@novamart.test" });
    expect(audit.details).toMatchObject({ suggestedQty: qty, note: "Supplier confirmed", inventoryChange: { orderedQty: qty, incomingBefore: 0, incomingAfter: qty } });

    const feed = await as(manager.token, "get", "/api/ops/audit?limit=5");
    expect(feed.body[0]).toMatchObject({ action: "REPLENISHMENT_APPROVED", entityId: String(action.id) });
  });

  it("returns 409 on repeated approval and does not change inventory again", async () => {
    const action = await prisma.agentAction.findFirstOrThrow({ where: { storeId: FAR01, productId: productIds.P504 } });
    const before = await inventoryOf("P504");
    const res = await as(manager.token, "post", `/api/ops/actions/${action.id}/approve`);
    expect(res.status).toBe(409);
    expect(await inventoryOf("P504")).toEqual(before);
    expect(await prisma.auditLog.count({ where: { entity: "agent_action", entityId: String(action.id) } })).toBe(1);
  });

  it("applies exactly one of two simultaneous approvals", async () => {
    const action = await proposalFor("P505");
    const qty = (action.payload as { suggestedQty: number }).suggestedQty;
    const before = await inventoryOf("P505");

    const results = await Promise.all([1, 2, 3].map(() => as(manager.token, "post", `/api/ops/actions/${action.id}/approve`)));
    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409]);
    expect((await inventoryOf("P505")).incomingQty).toBe(before.incomingQty + qty);
    expect(await prisma.auditLog.count({ where: { entity: "agent_action", entityId: String(action.id) } })).toBe(1);
  });

  it("returns 404 for an unknown action and 400 for an invalid id or body", async () => {
    expect((await as(manager.token, "post", "/api/ops/actions/999999/approve")).status).toBe(404);
    expect((await as(manager.token, "post", "/api/ops/actions/abc/approve")).status).toBe(400);
    expect((await as(manager.token, "post", "/api/ops/actions/1/approve", { qty: 5000 })).status).toBe(400); // quantity can't be supplied
  });
});

describe("reject", () => {
  it("rejects once, leaves inventory alone, audits it, and blocks a later approval", async () => {
    // A fresh proposal: put P504 back to low stock with nothing incoming, and allow a new proposal today.
    await prisma.inventory.update({ where: { storeId_productId: { storeId: FAR01, productId: productIds.P504 } }, data: { incomingQty: 0 } });
    await prisma.agentAction.deleteMany({ where: { storeId: FAR01, productId: productIds.P504 } });
    mockGroq("down"); // explanations fall back to templates
    const created = (await scan()).body.created;
    expect(created).toHaveLength(1);
    const id = created[0].id;
    const before = await inventoryOf("P504");

    const res = await as(manager.token, "post", `/api/ops/actions/${id}/reject`, { note: "Overstock expected" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "REJECTED", decidedBy: { id: manager.id } });
    expect(await inventoryOf("P504")).toEqual(before);
    expect(await prisma.auditLog.findFirst({ where: { entityId: String(id), action: "REPLENISHMENT_REJECTED" } })).not.toBeNull();

    expect((await as(manager.token, "post", `/api/ops/actions/${id}/reject`)).status).toBe(409);
    expect((await as(manager.token, "post", `/api/ops/actions/${id}/approve`)).status).toBe(409);
    expect(await inventoryOf("P504")).toEqual(before);
  });
});
