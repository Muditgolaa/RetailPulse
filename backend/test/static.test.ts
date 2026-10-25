// Production mode: Express serves the built frontend next to the API (FRONTEND_DIST).
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

const dist = mkdtempSync(path.join(tmpdir(), "rp-dist-"));
mkdirSync(path.join(dist, "assets"));
writeFileSync(path.join(dist, "index.html"), "<!doctype html><title>RetailPulse AI</title>");
writeFileSync(path.join(dist, "assets", "index-abc123.js"), "console.log('app')");
process.env.FRONTEND_DIST = dist;

vi.mock("../src/db.js", () => ({ isDatabaseUp: vi.fn(async () => true), prisma: {} }));
const { app } = await import("../src/app.js");

describe("serving the frontend", () => {
  it("returns index.html for the home page and for client-side routes", async () => {
    for (const url of ["/", "/orders", "/ops/knowledge", "/products/P101"]) {
      const res = await request(app).get(url);
      expect(res.status, url).toBe(200);
      expect(res.text).toContain("<title>RetailPulse AI</title>");
    }
  });

  it("serves hashed assets with a long cache lifetime", async () => {
    const res = await request(app).get("/assets/index-abc123.js");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toContain("immutable");
  });

  it("keeps unknown API routes as JSON 404s instead of the app page", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });

  it("sends basic security headers", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers).toMatchObject({ "x-content-type-options": "nosniff", "x-frame-options": "DENY" });
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
