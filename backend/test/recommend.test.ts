// POST /api/ai/recommend against the seeded database, with Groq replies mocked (no network, no tokens).
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.GROQ_API_KEY ||= "gsk_test_key_for_recommend_tests_000000";
const { app } = await import("../src/app.js");
const { prisma } = await import("../src/db.js");
const { signToken } = await import("../src/auth/jwt.js");
const { resetAiRateLimit } = await import("../src/routes/ai.js");

const DEMO = "Recommend a laptop under ₹80,000 for Java development, Docker, and some gaming.";
const LAPTOP_INTENT = {
  isShoppingRequest: true, category: "Laptops", minBudget: null, maxBudget: 80000,
  brands: [], mustHave: ["16 GB RAM", "dedicated GPU"], useCase: "Java development, Docker and light gaming",
};

let token = "";
const groqReply = (obj: unknown) =>
  new Response(JSON.stringify({ model: "test", choices: [{ message: { content: typeof obj === "string" ? obj : JSON.stringify(obj) }, finish_reason: "stop" }] }), { status: 200 });

// Each Groq chat call takes the next reply from the queue.
function mockGroq(...replies: (unknown | Response)[]) {
  const queue = [...replies];
  vi.stubGlobal("fetch", vi.fn(async () => {
    const next = queue.shift();
    if (next === undefined) throw new Error("unexpected extra Groq call");
    return next instanceof Response ? next : groqReply(next);
  }));
}
const groqDown = () => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "down" } }), { status: 500 })));
const ask = (body: unknown, auth = true) => {
  const req = request(app).post("/api/ai/recommend");
  return (auth ? req.set("Authorization", `Bearer ${token}`) : req).send(body as object);
};

beforeAll(async () => {
  const priya = await prisma.user.findUniqueOrThrow({ where: { email: "priya@novamart.test" } });
  token = signToken(priya.id);
  vi.spyOn(prisma.aiCallLog, "create").mockResolvedValue({} as never); // keep test calls out of ai_call_logs
});
beforeEach(() => {
  vi.unstubAllGlobals();
  resetAiRateLimit();
});
afterAll(() => prisma.$disconnect());

// The truth, read straight from PostgreSQL.
async function dbFacts(sku: string, storeId: number) {
  const p = await prisma.product.findUniqueOrThrow({ where: { sku }, include: { inventory: { where: { storeId } } } });
  return { price: Number(p.price), specs: p.specs, available: p.inventory[0].onHand - p.inventory[0].reserved };
}

describe("invalid product ID guard", () => {
  it("drops unknown, duplicate and non-candidate IDs, keeping only real candidates", async () => {
    mockGroq(LAPTOP_INTENT, {
      interpretedRequirement: "Laptop for Java and Docker",
      recommendations: [
        { productId: "P999", reason: "Does not exist." },
        { productId: "P101", reason: "16 GB DDR5 and RTX 3050 within budget." },
        { productId: "p101", reason: "Duplicate in lower case." },
        { productId: "P201", reason: "A phone, real but not a laptop candidate." },
        { productId: "P103", reason: "16 GB DDR4 with RTX 2050." },
        { productId: "P102", reason: "16 GB RAM and Ryzen 7." },
      ],
    });
    const res = await ask({ query: DEMO, storeId: 1 });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("AI");
    expect(res.body.recommendations.map((r: { productId: string }) => r.productId)).toEqual(["P101", "P103", "P102"]);
    expect(res.body.meta.rejectedProductIds).toEqual(["P999", "p101", "P201"]);
  });

  it("falls back to deterministic ranking when every AI pick is invalid", async () => {
    mockGroq(LAPTOP_INTENT, { recommendations: [{ productId: "P999", reason: "x" }, { productId: "DROP TABLE products", reason: "x" }] });
    const res = await ask({ query: DEMO, storeId: 1 });
    expect(res.body.source).toBe("FALLBACK");
    expect(res.body.notice).toMatch(/no valid products/);
    expect(res.body.recommendations).toHaveLength(3);
    expect(res.body.meta.rejectedProductIds).toHaveLength(2);
  });
});

describe("prices, specs and stock come from PostgreSQL", () => {
  it("matches the database for every recommended product at the selected store", async () => {
    for (const storeId of [1, 2]) {
      mockGroq(LAPTOP_INTENT, { recommendations: [{ productId: "P101", reason: "ok" }, { productId: "P103", reason: "ok" }] });
      const res = await ask({ query: DEMO, storeId });
      for (const rec of res.body.recommendations) {
        const db = await dbFacts(rec.productId, storeId);
        expect(rec.price).toBe(db.price);
        expect(rec.specs).toEqual(db.specs);
        expect(rec.availableQty).toBe(db.available);
      }
    }
  });

  it("marks P101 out of stock at DEL01 and suggests a store that has it", async () => {
    mockGroq(LAPTOP_INTENT, { recommendations: [{ productId: "P101", reason: "ok" }] });
    const res = await ask({ query: DEMO, storeId: 1 });
    const p101 = res.body.recommendations[0];
    expect(p101).toMatchObject({ productId: "P101", availability: "OUT_OF_STOCK", availableQty: 0, storeCode: "DEL01" });
    expect(p101.alternativeStore.available).toBeGreaterThan(0);
  });

  it("replaces a reason that cites numbers not in the product data", async () => {
    mockGroq(LAPTOP_INTENT, { recommendations: [{ productId: "P102", reason: "Has 32 GB RAM and costs only ₹50,000." }] });
    const res = await ask({ query: DEMO, storeId: 1 });
    expect(res.body.recommendations[0].reason).not.toContain("32 GB");
    expect(res.body.recommendations[0].reason).toMatch(/^Rated 4\.4 at ₹62,990/);
  });
});

describe("deterministic fallback", () => {
  it("answers the demo request without the AI provider", async () => {
    groqDown();
    const res = await ask({ query: DEMO, storeId: 1 });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("FALLBACK");
    expect(res.body.notice).toMatch(/unavailable/);
    expect(res.body.interpretedRequirement).toBe("Laptops under ₹80,000 with 16 GB, RTX");
    // 16 GB + RTX first, in-stock before out-of-stock, then rating
    expect(res.body.recommendations.map((r: { productId: string }) => r.productId)).toEqual(["P103", "P101", "P102"]);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1); // no second AI call once the provider failed
  });

  it("uses deterministic ranking when the ranker returns invalid JSON", async () => {
    mockGroq(LAPTOP_INTENT, "this is not json");
    const res = await ask({ query: DEMO, storeId: 1 });
    expect(res.body.source).toBe("FALLBACK");
    expect(res.body.recommendations).toHaveLength(3);
  });
});

describe("clarification", () => {
  it("asks a clarifying question for an ambiguous request", async () => {
    mockGroq({ isShoppingRequest: true, category: null, minBudget: null, maxBudget: null, brands: [], mustHave: [], useCase: null });
    const res = await ask({ query: "suggest something good" });
    expect(res.body.recommendations).toEqual([]);
    expect(res.body.clarifyingQuestion).toMatch(/budget/);
  });

  it("asks a clarifying question when the provider is down and the text has no product or budget", async () => {
    groqDown();
    const res = await ask({ query: "suggest something good" });
    expect(res.body.clarifyingQuestion).toMatch(/budget/);
  });

  it("ignores invented categories and brands from the model", async () => {
    mockGroq({ isShoppingRequest: true, category: "Spaceships", minBudget: null, maxBudget: null, brands: ["Acme"], mustHave: [], useCase: null });
    const res = await ask({ query: "a spaceship" });
    expect(res.body.clarifyingQuestion).not.toBeNull();
  });

  it("offers to change the budget when nothing matches", async () => {
    mockGroq({ ...LAPTOP_INTENT, maxBudget: 10000 });
    const res = await ask({ query: "laptop under ₹10,000" });
    expect(res.body.recommendations).toEqual([]);
    expect(res.body.clarifyingQuestion).toMatch(/raise the budget/);
  });
});

describe("validation and access", () => {
  it("requires sign-in", async () => {
    expect((await ask({ query: DEMO }, false)).status).toBe(401);
  });

  it.each([
    [{ query: "" }, "empty query"],
    [{ query: "x".repeat(501) }, "query over 500 characters"],
    [{ query: DEMO, storeId: 999 }, "unknown store"],
    [{ query: DEMO, storeId: "DEL01" }, "store id not a number"],
    [{}, "missing query"],
  ])("returns 400 for %j (%s)", async (body) => {
    expect((await ask(body)).status).toBe(400);
  });

  it("rate-limits a user after 10 requests a minute", async () => {
    groqDown();
    for (let i = 0; i < 10; i++) expect((await ask({ query: "suggest something good" })).status).toBe(200);
    expect((await ask({ query: "suggest something good" })).status).toBe(429);
  });
});
