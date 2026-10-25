// Sign-up, admin promotion by email, admin settings and user management, against the seeded database.
// Every account and setting this file creates is removed afterwards.
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const ADMIN_EMAIL = "owner.test@example.com";
process.env.ADMIN_EMAILS = `${ADMIN_EMAIL}, second.admin.test@example.com`;
process.env.DEMO_LOGIN_ENABLED = "false";

const { app } = await import("../src/app.js");
const { prisma } = await import("../src/db.js");
const { signToken } = await import("../src/auth/jwt.js");
const { resetAuthRateLimit } = await import("../src/lib/rateLimit.js");

const startedAt = new Date();
let customerToken = "";
let managerToken = "";

const register = (body: object) => request(app).post("/api/auth/register").send(body);
const as = (token: string, method: "get" | "put" | "patch", url: string, body?: object) =>
  request(app)[method](url).set("Authorization", `Bearer ${token}`).send(body ?? {});
const newCustomer = (name = "Asha Test") => ({ name, email: `${name.toLowerCase().replace(/\W+/g, ".")}.test@example.com`, password: "correct-horse-1" });

async function adminToken() {
  const res = await register({ name: "Site Owner", email: ADMIN_EMAIL, password: "owner-password-1" });
  if (res.status === 201) return res.body.token as string;
  return (await request(app).post("/api/auth/login").send({ email: ADMIN_EMAIL, password: "owner-password-1" })).body.token as string;
}

beforeAll(async () => {
  const [priya, rahul] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "priya@novamart.test" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "rahul@novamart.test" } }),
  ]);
  customerToken = signToken(priya.id);
  managerToken = signToken(rahul.id);
});

beforeEach(() => resetAuthRateLimit());

afterAll(async () => {
  await prisma.appSetting.deleteMany();
  await prisma.auditLog.deleteMany({ where: { createdAt: { gte: startedAt }, entity: { in: ["user", "app_settings"] } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: ".test@example.com" } } });
  await prisma.user.updateMany({ where: { email: "arjun@novamart.test" }, data: { role: "CUSTOMER", membershipTier: "STANDARD" } });
  await prisma.$disconnect();
});

describe("POST /api/auth/register", () => {
  it("creates a Standard customer, signs them in, and never returns the password hash", async () => {
    const res = await register(newCustomer());
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ email: "asha.test.test@example.com", role: "CUSTOMER", membershipTier: "STANDARD", preferredStoreId: 1 });
    expect(res.body.user).not.toHaveProperty("passwordHash");

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${res.body.token}`);
    expect(me.body.user.name).toBe("Asha Test");
    const login = await request(app).post("/api/auth/login").send({ email: "Asha.Test.test@example.com", password: "correct-horse-1" });
    expect(login.status).toBe(200);
  });

  it("returns 409 for an email that already has an account", async () => {
    await register(newCustomer("Dup User"));
    expect((await register(newCustomer("Dup User"))).status).toBe(409);
  });

  it.each([
    [{ name: "A", email: "short.test@example.com", password: "long-enough-1" }, "name too short"],
    [{ name: "Bad Email", email: "not-an-email", password: "long-enough-1" }, "invalid email"],
    [{ name: "Short Pass", email: "pass.test@example.com", password: "1234567" }, "password under 8 characters"],
    [{ name: "Sneaky", email: "sneaky.test@example.com", password: "long-enough-1", role: "ADMIN" }, "trying to choose a role"],
    [{ name: "Sneaky", email: "tier.test@example.com", password: "long-enough-1", membershipTier: "PLATINUM" }, "trying to choose a tier"],
  ])("returns 400 for %j (%s)", async (body) => {
    expect((await register(body)).status).toBe(400);
  });

  it("makes an ADMIN_EMAILS address an admin, and that admin can use manager pages", async () => {
    const token = await adminToken();
    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.body.user.role).toBe("ADMIN");
    expect((await as(token, "get", "/api/ops/dashboard?storeId=1")).status).toBe(200);
  });

  it("promotes an existing account listed in ADMIN_EMAILS when it signs in", async () => {
    await prisma.user.create({ data: { email: "second.admin.test@example.com", name: "Second", passwordHash: await import("bcryptjs").then((b) => b.hash("second-pass-1", 4)) } });
    const res = await request(app).post("/api/auth/login").send({ email: "second.admin.test@example.com", password: "second-pass-1" });
    expect(res.body.user.role).toBe("ADMIN");
  });

  it("limits repeated sign-in attempts from one address", async () => {
    const attempt = () => request(app).post("/api/auth/login").send({ email: "nobody.test@example.com", password: "wrong-password" });
    for (let i = 0; i < 20; i++) expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(429);
  });
});

describe("site settings", () => {
  it("are public to read and default to the environment", async () => {
    await prisma.appSetting.deleteMany();
    const res = await request(app).get("/api/settings");
    expect(res.body).toEqual({ demoAccess: false, signupEnabled: true });
  });

  it("let an admin switch demo access on and off without a redeploy", async () => {
    const token = await adminToken();
    expect((await request(app).post("/api/auth/demo").send({ account: "customer" })).status).toBe(403);

    const on = await as(token, "put", "/api/admin/settings", { demoAccess: true });
    expect(on.body).toEqual({ demoAccess: true, signupEnabled: true });
    expect((await request(app).get("/api/settings")).body.demoAccess).toBe(true);
    expect((await request(app).post("/api/auth/demo").send({ account: "customer" })).status).toBe(200);

    await as(token, "put", "/api/admin/settings", { demoAccess: false });
    expect((await request(app).post("/api/auth/demo").send({ account: "customer" })).status).toBe(403);
    expect(await prisma.auditLog.count({ where: { action: "SETTINGS_CHANGED", createdAt: { gte: startedAt } } })).toBe(2);
  });

  it("let an admin close sign-ups, except for admin emails", async () => {
    const token = await adminToken();
    await as(token, "put", "/api/admin/settings", { signupEnabled: false });
    expect((await register(newCustomer("Closed Out"))).status).toBe(403);
    await as(token, "put", "/api/admin/settings", { signupEnabled: true });
    expect((await register(newCustomer("Open Again"))).status).toBe(201);
  });

  it("reject unknown settings and non-admins", async () => {
    const token = await adminToken();
    expect((await as(token, "put", "/api/admin/settings", { maintenanceMode: true })).status).toBe(400);
    expect((await as(token, "put", "/api/admin/settings", { demoAccess: "yes" })).status).toBe(400);
    expect((await as(managerToken, "put", "/api/admin/settings", { demoAccess: true })).status).toBe(403);
    expect((await as(customerToken, "get", "/api/admin/settings")).status).toBe(403);
  });
});

describe("user management", () => {
  it("lists and searches users for admins only", async () => {
    const token = await adminToken();
    const res = await as(token, "get", "/api/admin/users?q=arjun");
    expect(res.status).toBe(200);
    expect(res.body.map((u: { email: string }) => u.email)).toEqual(["arjun@novamart.test"]);
    expect(res.body[0]).not.toHaveProperty("passwordHash");
    expect((await as(managerToken, "get", "/api/admin/users")).status).toBe(403);
  });

  it("changes a user's role and tier, and the change applies to their next request", async () => {
    const token = await adminToken();
    const arjun = await prisma.user.findUniqueOrThrow({ where: { email: "arjun@novamart.test" } });
    const res = await as(token, "patch", `/api/admin/users/${arjun.id}`, { role: "MANAGER", membershipTier: "GOLD" });
    expect(res.body).toMatchObject({ role: "MANAGER", membershipTier: "GOLD" });
    expect((await as(signToken(arjun.id), "get", "/api/ops/dashboard?storeId=1")).status).toBe(200);
    expect(await prisma.auditLog.count({ where: { action: "USER_UPDATED", entityId: String(arjun.id) } })).toBeGreaterThan(0);
  });

  it("never leaves the site without an admin", async () => {
    const token = await adminToken();
    const me = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });
    expect((await as(token, "patch", `/api/admin/users/${me.id}`, { role: "CUSTOMER" })).status).toBe(409);
    expect((await as(token, "patch", "/api/admin/users/999999", { role: "CUSTOMER" })).status).toBe(404);
    expect((await as(token, "patch", `/api/admin/users/${me.id}`, {})).status).toBe(400);
  });
});
