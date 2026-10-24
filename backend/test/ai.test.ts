// Groq client tests with a mocked fetch: no network calls, no tokens spent.
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

const FAKE_KEY = "gsk_unit_test_key_that_must_never_leak_123";
process.env.GROQ_API_KEY = FAKE_KEY;
process.env.GROQ_MODEL = "test-model";

vi.mock("../src/db.js", () => ({
  isDatabaseUp: vi.fn(async () => true),
  prisma: { aiCallLog: { create: vi.fn(() => Promise.resolve()) } },
}));

const { chat, checkAiHealth, AiProviderError } = await import("../src/ai/groq.js");
const { app } = await import("../src/app.js");
const { resetAiHealthCache } = await import("../src/routes/health.js");

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const mockFetch = (impl: (url: string, init?: RequestInit) => Promise<Response>) => vi.stubGlobal("fetch", vi.fn(impl));

afterEach(() => {
  vi.unstubAllGlobals();
  resetAiHealthCache();
});

describe("chat()", () => {
  it("sends the key only in the Authorization header and returns the reply", async () => {
    mockFetch(async () => json(200, { model: "test-model", choices: [{ message: { content: "OK" } }], usage: { prompt_tokens: 12, completion_tokens: 1 } }));
    const r = await chat([{ role: "user", content: "hi" }], { maxTokens: 5 });
    expect(r).toMatchObject({ content: "OK", model: "test-model", promptTokens: 12, completionTokens: 1 });

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${FAKE_KEY}`);
    expect(String(init.body)).not.toContain(FAKE_KEY);
    expect(JSON.parse(String(init.body))).toMatchObject({ model: "test-model", max_tokens: 5 });
    expect(init.signal).toBeInstanceOf(AbortSignal); // a timeout is always set
  });

  it.each([
    [401, { error: { message: "Invalid API Key" } }, "AUTH", 503],
    [404, { error: { message: "The model `x` does not exist", code: "model_not_found" } }, "MODEL_NOT_FOUND", 503],
    [429, { error: { message: "Rate limit" } }, "RATE_LIMITED", 429],
    [500, { error: { message: "boom" } }, "UNAVAILABLE", 503],
    [400, { error: { message: "bad request" } }, "BAD_RESPONSE", 502],
  ])("maps HTTP %i to %s", async (status, body, kind, httpStatus) => {
    mockFetch(async () => json(status, body, { "retry-after": "7" }));
    const err = await chat([{ role: "user", content: "hi" }]).catch((e) => e);
    expect(err).toBeInstanceOf(AiProviderError);
    expect(err).toMatchObject({ kind, httpStatus });
    if (kind === "RATE_LIMITED") expect(err.retryAfterSeconds).toBe(7);
  });

  it("fails clearly when a reasoning model spends the whole budget before answering", async () => {
    mockFetch(async () => json(200, { model: "test-model", choices: [{ message: { content: "" }, finish_reason: "length" }] }));
    await expect(chat([{ role: "user", content: "hi" }], { maxTokens: 5 })).rejects.toMatchObject({ kind: "BAD_RESPONSE" });
  });

  it("reports a timeout when Groq does not answer in time", async () => {
    mockFetch(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    });
    await expect(chat([{ role: "user", content: "hi" }], { timeoutMs: 1000 })).rejects.toMatchObject({ kind: "TIMEOUT" });
  });

  it("reports a network failure as UNAVAILABLE", async () => {
    mockFetch(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(chat([{ role: "user", content: "hi" }])).rejects.toMatchObject({ kind: "UNAVAILABLE" });
  });

  it("scrubs the key if the provider ever echoes it back", async () => {
    mockFetch(async () => json(400, { error: { message: `bad key ${FAKE_KEY}` } }));
    const err = await chat([{ role: "user", content: "hi" }]).catch((e) => e);
    expect(err.message).not.toContain(FAKE_KEY);
    expect(err.message).toContain("[redacted]");
  });
});

describe("GET /api/health/ai", () => {
  it("returns 200 when the configured model is listed, without exposing the key", async () => {
    mockFetch(async () => json(200, { data: [{ id: "other" }, { id: "test-model" }] }));
    const res = await request(app).get("/api/health/ai");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ provider: "groq", configured: true, reachable: true, model: "test-model", modelAvailable: true });
    expect(JSON.stringify(res.body)).not.toContain(FAKE_KEY);
  });

  it("returns 503 when the model is not on the account", async () => {
    mockFetch(async () => json(200, { data: [{ id: "other" }] }));
    const res = await request(app).get("/api/health/ai");
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ reachable: true, modelAvailable: false, error: { kind: "MODEL_NOT_FOUND" } });
  });

  it("returns 503 with AUTH when the key is rejected", async () => {
    mockFetch(async () => json(401, { error: { message: "Invalid API Key" } }));
    const res = await request(app).get("/api/health/ai");
    expect(res.status).toBe(503);
    expect(res.body.error.kind).toBe("AUTH");
    expect(JSON.stringify(res.body)).not.toContain(FAKE_KEY);
  });

  it("caches the result so repeated calls do not hit Groq", async () => {
    mockFetch(async () => json(200, { data: [{ id: "test-model" }] }));
    await request(app).get("/api/health/ai");
    await request(app).get("/api/health/ai");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
});

describe("checkAiHealth()", () => {
  it("does not spend tokens: it only lists models", async () => {
    mockFetch(async () => json(200, { data: [{ id: "test-model" }] }));
    await checkAiHealth();
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("https://api.groq.com/openai/v1/models");
  });
});
