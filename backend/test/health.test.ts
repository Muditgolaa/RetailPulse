import request from "supertest";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/db.js", () => ({ isDatabaseUp: vi.fn() }));

const { app } = await import("../src/app.js");
const { isDatabaseUp } = await import("../src/db.js");

describe("GET /api/health", () => {
  it("returns 200 when the database is up", async () => {
    vi.mocked(isDatabaseUp).mockResolvedValue(true);
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", database: "up" });
  });

  it("returns 503 when the database is down", async () => {
    vi.mocked(isDatabaseUp).mockResolvedValue(false);
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: "degraded", database: "down" });
  });

  it("returns JSON 404 for unknown API routes", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });
});
