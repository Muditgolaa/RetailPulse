// Knowledge-base uploads against the real pgvector index and local embeddings. Groq is mocked.
// Every document this file creates is removed afterwards.
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.GROQ_API_KEY ||= "gsk_test_key_for_kb_tests_000000000000";
const { app } = await import("../src/app.js");
const { prisma } = await import("../src/db.js");
const { signToken } = await import("../src/auth/jwt.js");
const { resetAiRateLimit } = await import("../src/lib/rateLimit.js");
const { prepareBody, slugify } = await import("../src/rag/documents.js");

const startedAt = new Date();
const tokens = { rahul: "", priya: "", arjun: "" };
const GIFT_DOC = "test-gift-wrapping-service";

const giftWrapping = {
  title: "Test Gift Wrapping Service",
  docType: "STORE_PROCEDURE",
  version: "1.0",
  effectiveDate: "2026-01-01",
  content: "# Gift Wrapping\n\n## Gift wrapping at the counter\n\nNovaMart stores wrap any gift purchase at the billing counter for ₹99 per item, using recycled kraft paper.\n\n## Gift notes\n\nA handwritten gift note can be added free of charge.",
};

const realFetch = globalThis.fetch;
let groqBodies: string[] = [];
function mockGroqAnswer() {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (!String(url).includes("api.groq.com")) return realFetch(url, init);
    groqBodies.push(String(init?.body));
    const content = JSON.stringify({ supported: true, answer: "Gift wrapping costs ₹99 per item.", citations: ["S1"] });
    return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }] }), { status: 200 });
  }));
}

const as = (who: keyof typeof tokens, method: "get" | "post" | "delete", url: string, body?: object) =>
  request(app)[method](url).set("Authorization", `Bearer ${tokens[who]}`).send(body ?? {});
const upload = (body: object, who: keyof typeof tokens = "rahul") => as(who, "post", "/api/kb/documents", body);
const askPolicy = (who: keyof typeof tokens, question: string) => as(who, "post", "/api/ai/ask", { question });

beforeAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: ["rahul@novamart.test", "priya@novamart.test", "arjun@novamart.test"] } } });
  for (const u of users) tokens[u.email.split("@")[0] as keyof typeof tokens] = signToken(u.id);
  vi.spyOn(prisma.aiCallLog, "create").mockResolvedValue({} as never);
}, 60_000);

beforeEach(() => {
  vi.unstubAllGlobals();
  resetAiRateLimit();
  groqBodies = [];
});

afterAll(async () => {
  await prisma.knowledgeChunk.deleteMany({ where: { documentId: { startsWith: "test-" } } });
  await prisma.auditLog.deleteMany({ where: { createdAt: { gte: startedAt }, entity: "knowledge_document" } });
  await prisma.$disconnect();
});

describe("POST /api/kb/documents", () => {
  it("chunks and embeds an upload, and customers can ask about it straight away", async () => {
    const res = await upload(giftWrapping);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ documentId: GIFT_DOC, version: "1.0", chunks: 2, unchanged: false, sections: ["Gift wrapping at the counter", "Gift notes"] });

    mockGroqAnswer();
    const answer = await askPolicy("arjun", "How much does gift wrapping cost at the store?");
    expect(answer.body.status).toBe("ANSWERED");
    expect(answer.body.sources[0]).toMatchObject({ documentId: GIFT_DOC, section: "Gift wrapping at the counter", version: "1.0" });
    expect(groqBodies[0]).toContain("₹99 per item");

    const audit = await prisma.auditLog.findFirst({ where: { action: "KB_DOCUMENT_UPLOADED", entityId: GIFT_DOC } });
    expect(audit?.actorEmail).toBe("rahul@novamart.test");
  });

  it("skips re-embedding an identical upload and replaces chunks for a new version", async () => {
    const same = await upload(giftWrapping);
    expect(same.status).toBe(200);
    expect(same.body.unchanged).toBe(true);

    const v2 = await upload({ ...giftWrapping, version: "2.0", content: "## Gift wrapping at the counter\n\nGift wrapping is now free for all members." });
    expect(v2.status).toBe(201);
    expect(v2.body).toMatchObject({ version: "2.0", chunks: 1, replacedVersion: "1.0" });
    const chunks = await prisma.knowledgeChunk.findMany({ where: { documentId: GIFT_DOC } });
    expect(chunks.map((c) => c.version)).toEqual(["2.0"]);
  });

  it("keeps a Gold-only upload away from Standard members", async () => {
    await upload({ ...giftWrapping, title: "Test Gold Lounge Access", tier: "GOLD", content: "## Gold lounge\n\nGold members can use the NovaMart lounge at Connaught Place for free coffee." });
    mockGroqAnswer();
    const standard = await askPolicy("arjun", "Can I use the NovaMart lounge for free coffee?");
    expect(standard.body.sources.map((s: { documentId: string }) => s.documentId)).not.toContain("test-gold-lounge-access");
    const gold = await askPolicy("priya", "Can I use the NovaMart lounge for free coffee?");
    expect(gold.body.sources.map((s: { documentId: string }) => s.documentId)).toContain("test-gold-lounge-access");
  });

  it.each([
    [{ ...giftWrapping, content: "too short" }, "empty document"],
    [{ ...giftWrapping, content: "x".repeat(100_001) }, "too large"],
    [{ ...giftWrapping, effectiveDate: "next week" }, "invalid date"],
    [{ ...giftWrapping, docType: "SECRET" }, "unknown document type"],
    [{ ...giftWrapping, tier: "DIAMOND" }, "unknown tier"],
    [{ ...giftWrapping, version: "v 1" }, "invalid version"],
    [{ ...giftWrapping, documentId: "returns-refunds-policy" }, "id supplied by the client"],
    [{ ...giftWrapping, title: "!!!" }, "title without letters"],
  ])("returns 400 for %s", async (body) => {
    expect((await upload(body)).status).toBe(400);
  });

  it("is for managers only", async () => {
    expect((await upload(giftWrapping, "priya")).status).toBe(403);
    expect((await request(app).post("/api/kb/documents").send(giftWrapping)).status).toBe(401);
  });
});

describe("listing and deleting", () => {
  it("lists one row per document with its sections and chunk count", async () => {
    await upload({ ...giftWrapping, title: "Test Listing Doc" });
    const res = await as("rahul", "get", "/api/kb/documents");
    expect(res.status).toBe(200);
    const row = res.body.find((d: { documentId: string }) => d.documentId === "test-listing-doc");
    expect(row).toMatchObject({ title: "Test Listing Doc", docType: "STORE_PROCEDURE", version: "1.0", effectiveDate: "2026-01-01", chunks: 2, tiers: ["ALL"] });
    expect(res.body.some((d: { documentId: string }) => d.documentId === "returns-refunds-policy")).toBe(true);
    expect((await as("priya", "get", "/api/kb/documents")).status).toBe(403);
  });

  it("deletes a document so it can no longer be retrieved", async () => {
    await upload({ ...giftWrapping, title: "Test Delete Me" });
    const res = await as("rahul", "delete", "/api/kb/documents/test-delete-me");
    expect(res.body).toEqual({ documentId: "test-delete-me", deletedChunks: 2 });
    expect(await prisma.knowledgeChunk.count({ where: { documentId: "test-delete-me" } })).toBe(0);
    expect((await as("rahul", "delete", "/api/kb/documents/test-delete-me")).status).toBe(404);
    expect((await as("rahul", "delete", "/api/kb/documents/Bad_Id!")).status).toBe(400);
    expect((await as("priya", "delete", "/api/kb/documents/returns-refunds-policy")).status).toBe(403);
  });
});

describe("helpers", () => {
  it("turns titles into document ids", () => {
    expect(slugify("Gift Wrapping & Store Services (2026)")).toBe("gift-wrapping-store-services-2026");
  });

  it("strips front matter and gives plain text an Overview section", () => {
    expect(prepareBody("---\ndocId: x\n---\n# Title\n\n## A\n\ntext")).toBe("# Title\n\n## A\n\ntext");
    expect(prepareBody("# Store hours\n\nOpen 10 am to 10 pm daily.")).toBe("## Overview\n\nOpen 10 am to 10 pm daily.");
  });
});
