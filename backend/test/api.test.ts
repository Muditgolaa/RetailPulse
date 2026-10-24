// Integration tests against the seeded development database.
// Needs: `docker compose up -d`, `npm run db:seed`, and SEED_DEMO_PASSWORD + JWT_SECRET in backend/.env.
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.DEMO_LOGIN_ENABLED = "true";
const { app } = await import("../src/app.js");
const { prisma } = await import("../src/db.js");

const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "";
const login = (email: string, password = PASSWORD) => request(app).post("/api/auth/login").send({ email, password });

let customerToken = "";
let managerToken = "";

beforeAll(async () => {
  expect(PASSWORD, "SEED_DEMO_PASSWORD must be set in backend/.env").not.toBe("");
  customerToken = (await login("priya@novamart.test")).body.token;
  managerToken = (await login("rahul@novamart.test")).body.token;
});
afterAll(() => prisma.$disconnect());

describe("POST /api/auth/login", () => {
  it("signs in a customer and returns a token without the password hash", async () => {
    const res = await login("Priya@NovaMart.test"); // email is case-insensitive
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ email: "priya@novamart.test", role: "CUSTOMER", membershipTier: "GOLD" });
    expect(res.body.user).not.toHaveProperty("passwordHash");
  });

  it("returns 401 for a wrong password and for an unknown email, with the same message", async () => {
    const wrong = await login("priya@novamart.test", "not-the-password");
    const unknown = await login("nobody@novamart.test", "whatever-123");
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toBe(unknown.body.error);
  });

  it("returns 400 for a missing or invalid body", async () => {
    expect((await request(app).post("/api/auth/login").send({ email: "not-an-email", password: "x" })).status).toBe(400);
    expect((await request(app).post("/api/auth/login").send({})).status).toBe(400);
    const badJson = await request(app).post("/api/auth/login").set("content-type", "application/json").send("{oops");
    expect(badJson.status).toBe(400);
  });
});

describe("GET /api/auth/me", () => {
  it("returns the user from a valid token", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: "rahul@novamart.test", role: "MANAGER" });
  });

  it("returns 401 without a token, with a malformed token, or with a forged signature", async () => {
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
    expect((await request(app).get("/api/auth/me").set("Authorization", "Bearer abc.def.ghi")).status).toBe(401);
    const forged = jwt.sign({}, "x".repeat(40), { subject: "1", issuer: "retailpulse" });
    expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${forged}`)).status).toBe(401);
  });
});

describe("manager-only routes", () => {
  it("returns 401 without a token", async () => {
    expect((await request(app).get("/api/ops/dashboard?storeId=1")).status).toBe(401);
  });

  it("returns 403 for a customer", async () => {
    const res = await request(app).get("/api/ops/dashboard?storeId=1").set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it("ignores a role claim in the token: the role always comes from the database", async () => {
    const priya = await prisma.user.findUniqueOrThrow({ where: { email: "priya@novamart.test" } });
    const claimsManager = jwt.sign({ role: "MANAGER" }, process.env.JWT_SECRET!, { subject: String(priya.id), issuer: "retailpulse" });
    const res = await request(app).get("/api/ops/dashboard?storeId=1").set("Authorization", `Bearer ${claimsManager}`);
    expect(res.status).toBe(403);
  });

  it("returns the DEL01 stock overview for a manager", async () => {
    const res = await request(app).get("/api/ops/dashboard?storeId=1").set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.kpis).toMatchObject({ activeSkus: 50, needsAttention: 4, critical: 3 });
  });
});

describe("GET /api/stores", () => {
  it("lists the four seeded stores", async () => {
    const res = await request(app).get("/api/stores");
    expect(res.status).toBe(200);
    expect(res.body.map((s: { code: string }) => s.code)).toEqual(["DEL01", "GGN01", "NOIDA01", "FAR01"]);
  });
});

describe("GET /api/products", () => {
  it("paginates the full catalogue", async () => {
    const first = await request(app).get("/api/products?size=12&page=0");
    const last = await request(app).get("/api/products?size=12&page=4");
    expect(first.body).toMatchObject({ totalElements: 50, totalPages: 5, number: 0, size: 12 });
    expect(first.body.content).toHaveLength(12);
    expect(last.body.content).toHaveLength(2);
    const ids = new Set([...first.body.content, ...last.body.content].map((p: { sku: string }) => p.sku));
    expect(ids.size).toBe(14); // no overlap between pages
  });

  it("filters by category and max price, sorted by price ascending", async () => {
    const res = await request(app).get("/api/products?category=Laptops&maxPrice=80000&sort=price,asc&size=48");
    const prices = res.body.content.map((p: { price: number }) => p.price);
    expect(res.body.totalElements).toBe(6);
    expect(res.body.content.every((p: { category: string }) => p.category === "Laptops")).toBe(true);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(Math.max(...prices)).toBeLessThanOrEqual(80000);
  });

  it("filters by brand, min price and search text", async () => {
    const brand = await request(app).get("/api/products?brand=Apple&minPrice=60000&size=48");
    expect(brand.body.content.every((p: { brand: string; price: number }) => p.brand === "Apple" && p.price >= 60000)).toBe(true);
    expect(brand.body.totalElements).toBe(3);
    const search = await request(app).get("/api/products?q=redmi");
    expect(search.body.content.map((p: { sku: string }) => p.sku)).toEqual(["P205"]);
  });

  it("returns per-store availability and the in-stock filter", async () => {
    const del = await request(app).get("/api/products?q=TUF&storeId=1");
    expect(del.body.content[0].availability).toMatchObject({ status: "OUT_OF_STOCK", available: 0, incomingQty: 8 });
    const ggn = await request(app).get("/api/products?q=TUF&storeId=2");
    expect(ggn.body.content[0].availability).toMatchObject({ available: 3 });
    const inStock = await request(app).get("/api/products?category=Laptops&storeId=1&inStock=true&size=48");
    expect(inStock.body.totalElements).toBe(9);
    expect(inStock.body.content.some((p: { sku: string }) => p.sku === "P101")).toBe(false);
  });

  it("returns prices from the database, not cost", async () => {
    const res = await request(app).get("/api/products?q=TUF");
    expect(res.body.content[0].price).toBe(76990);
    expect(res.body.content[0]).not.toHaveProperty("cost");
  });

  it("returns 400 for invalid parameters", async () => {
    for (const qs of ["size=0", "size=100", "page=-1", "sort=bogus", "minPrice=abc", "minPrice=500&maxPrice=100", "storeId=999", "inStock=true"]) {
      const res = await request(app).get(`/api/products?${qs}`);
      expect(res.status, qs).toBe(400);
    }
  });
});

describe("GET /api/products/:id", () => {
  it("finds a product by SKU or numeric id with availability at every store", async () => {
    const bySku = await request(app).get("/api/products/P101");
    expect(bySku.status).toBe(200);
    expect(bySku.body.availability).toHaveLength(4);
    const byId = await request(app).get(`/api/products/${bySku.body.id}`);
    expect(byId.body.sku).toBe("P101");
  });

  it("returns 404 for an unknown product", async () => {
    expect((await request(app).get("/api/products/P999")).status).toBe(404);
  });
});

describe("POST /api/auth/demo (temporary hackathon shortcut)", () => {
  it("issues a token for the seeded manager whose role comes from the database", async () => {
    const res = await request(app).post("/api/auth/demo").send({ account: "manager" });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("MANAGER");
    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${res.body.token}`);
    expect(me.body.user.email).toBe("rahul@novamart.test");
  });

  it("rejects anything but the two demo accounts", async () => {
    expect((await request(app).post("/api/auth/demo").send({ account: "admin" })).status).toBe(400);
  });
});
