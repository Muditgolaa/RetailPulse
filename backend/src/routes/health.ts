import { Router } from "express";
import { isDatabaseUp } from "../db.js";
import { checkAiHealth, type AiHealth } from "../ai/groq.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const dbUp = await isDatabaseUp();
  res.status(dbUp ? 200 : 503).json({
    status: dbUp ? "ok" : "degraded",
    database: dbUp ? "up" : "down",
    timestamp: new Date().toISOString(),
  });
});

// AI provider connectivity (model list only, no tokens spent). Cached so it can't be used to hammer Groq.
const AI_CACHE_MS = 60_000;
let cached: { at: number; value: AiHealth } | null = null;

healthRouter.get("/ai", async (_req, res) => {
  if (!cached || Date.now() - cached.at > AI_CACHE_MS) cached = { at: Date.now(), value: await checkAiHealth() };
  const ok = cached.value.reachable && cached.value.modelAvailable;
  res.status(ok ? 200 : 503).json(cached.value);
});

export const resetAiHealthCache = () => {
  cached = null;
};
