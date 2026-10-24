// Customer preferences and their effect on recommendations. Uses Arjun's account and restores it afterwards.
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.GROQ_API_KEY ||= "gsk_test_key_for_preference_tests_0000";
const { app } = await import("../src/app.js");
const { prisma } = await import("../src/db.js");
const { signToken } = await import("../src/auth/jwt.js");
const { resetAiRateLimit } = await import("../src/routes/ai.js");

let token = "";
let arjunId = 0;
let original: { preferredStoreId: number | null; preferences: unknown } = { preferredStoreId: null, preferences: {} };

const save = (body: object, auth = true) => {
  const req = request(app).put("/api/me/preferences").send(body);
  return auth ? req.set("Authorization", `Bearer ${token}`) : req;
};
const recommend = (query: string) => request(app).post("/api/ai/recommend").set("Authorization", `Bearer ${token}`).send({ query, storeId: 1 });
const valid = { preferredStoreId: 1, brands: ["Dell"], maxBudget: 60000 };

// Each Groq call takes the next reply; "down" makes the provider fail.
function mockGroq(...replies: unknown[]) {
  const queue = [...replies];
  vi.stubGlobal("fetch", vi.fn(async () => {
    const next = queue.shift();
    if (next === "down" || next === undefined) return new Response("{}", { status: 503 });
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(next) }, finish_reason: "stop" }] }), { status: 200 });
  }));
}
const laptopIntent = (maxBudget: number | null) => ({
  isShoppingRequest: true, category: "Laptops", minBudget: null, maxBudget, brands: [], mustHave: [], useCase: null,
});

beforeAll(async () => {
  const arjun = await prisma.user.findUniqueOrThrow({ where: { email: "arjun@novamart.test" } });
  arjunId = arjun.id;
  token = signToken(arjun.id);
  original = { preferredStoreId: arjun.preferredStoreId, preferences: arjun.preferences };
  vi.spyOn(prisma.aiCallLog, "create").mockResolvedValue({} as never);
});

beforeEach(() => {
  vi.unstubAllGlobals();
  resetAiRateLimit();
});

afterAll(async () => {
  await prisma.user.update({ where: { id: arjunId }, data: { preferredStoreId: original.preferredStoreId, preferences: original.preferences as object } });
  await prisma.$disconnect();
});

describe("PUT /api/me/preferences", () => {
  it("saves preferences with the catalogue's brand spelling and returns the user", async () => {
    const res = await save({ preferredStoreId: 2, brands: ["dell", "SONY", "Dell"], maxBudget: 45000 });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: "arjun@novamart.test", preferredStoreId: 2, preferences: { brands: ["Dell", "Sony"], maxBudget: 45000 } });
    expect(res.body.user).not.toHaveProperty("passwordHash");

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.body.user.preferences).toEqual({ brands: ["Dell", "Sony"], maxBudget: 45000 });
  });

  it("allows clearing the budget and store", async () => {
    const res = await save({ preferredStoreId: null, brands: [], maxBudget: null });
    expect(res.body.user).toMatchObject({ preferredStoreId: null, preferences: { brands: [], maxBudget: null } });
  });

  it.each([
    [{ ...valid, brands: ["Acme"] }, "unknown brand"],
    [{ ...valid, preferredStoreId: 999 }, "unknown store"],
    [{ ...valid, brands: ["Dell", "HP", "Sony", "Apple", "Lenovo", "ASUS"] }, "more than 5 brands"],
    [{ ...valid, maxBudget: 100 }, "budget too low"],
    [{ ...valid, maxBudget: 1.5e6 }, "budget too high"],
    [{ ...valid, role: "MANAGER" }, "trying to change the role"],
    [{ ...valid, userId: 1 }, "trying to change another user"],
    [{ brands: [] }, "missing fields"],
  ])("returns 400 for %j (%s)", async (body) => {
    expect((await save(body)).status).toBe(400);
  });

  it("requires sign-in", async () => {
    expect((await save(valid, false)).status).toBe(401);
  });
});

describe("preferences in recommendations", () => {
  it("uses the saved budget when the request names none", async () => {
    await save({ preferredStoreId: 1, brands: [], maxBudget: 60000 });
    mockGroq(laptopIntent(null), "down"); // ranking falls back, so the result is deterministic
    const res = await recommend("a good laptop");

    expect(res.body.interpretedRequirement).toBe("Laptops under ₹60,000 (budget from your preferences)");
    expect(res.body.meta.appliedPreferences).toEqual({ maxBudget: 60000, preferredBrands: [] });
    expect(res.body.recommendations.length).toBeGreaterThan(0);
    expect(res.body.recommendations.every((r: { price: number }) => r.price <= 60000)).toBe(true);
  });

  it("lets a budget in the request override the saved one", async () => {
    await save({ preferredStoreId: 1, brands: [], maxBudget: 60000 });
    mockGroq(laptopIntent(120000), "down");
    const res = await recommend("a laptop under 1.2 lakh");
    expect(res.body.meta.appliedPreferences.maxBudget).toBeNull();
    expect(res.body.recommendations.some((r: { price: number }) => r.price > 60000)).toBe(true);
  });

  it("breaks ties in favour of preferred brands without filtering other brands out", async () => {
    await save({ preferredStoreId: 1, brands: ["Dell"], maxBudget: null });
    mockGroq(laptopIntent(null), "down");
    const res = await recommend("a laptop");
    const brands = res.body.recommendations.map((r: { brand: string }) => r.brand);
    expect(brands.slice(0, 2)).toEqual(["Dell", "Dell"]);
    expect(brands).toContain("Apple"); // highest-rated laptop is still shown
  });

  it("sends preferred brands to the AI ranker as a tie-breaker", async () => {
    await save({ preferredStoreId: 1, brands: ["Dell"], maxBudget: null });
    mockGroq(laptopIntent(null), { recommendations: [{ productId: "P110", reason: "ok" }] });
    await recommend("a laptop");
    const rankRequest = String(vi.mocked(fetch).mock.calls[1][1]?.body);
    expect(rankRequest).toContain('PREFERRED_BRANDS: [\\"Dell\\"]');
  });
});
