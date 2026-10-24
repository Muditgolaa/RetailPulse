import type { RequestHandler } from "express";
import { HttpError } from "./http.js";

// Per-user limit on AI endpoints so one user can't burn the shared AI quota.
// Kept in memory, which is fine for a single server; a shared store would be needed with several.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const calls = new Map<number, number[]>();

export const aiRateLimit: RequestHandler = (req, _res, next) => {
  const now = Date.now();
  const recent = (calls.get(req.user!.id) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return next(new HttpError(429, "Too many AI requests. Please wait a minute."));
  calls.set(req.user!.id, [...recent, now]);
  next();
};

export const resetAiRateLimit = () => calls.clear();
