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

// Per-IP limit for sign-in and sign-up, to slow down password guessing and account spam.
const authAttempts = new Map<string, number[]>();
const AUTH_WINDOW_MS = 15 * 60_000;
const AUTH_MAX_ATTEMPTS = 20;

export const authRateLimit: RequestHandler = (req, _res, next) => {
  const key = req.ip ?? "unknown";
  const now = Date.now();
  const recent = (authAttempts.get(key) ?? []).filter((t) => now - t < AUTH_WINDOW_MS);
  if (recent.length >= AUTH_MAX_ATTEMPTS) return next(new HttpError(429, "Too many attempts. Please wait 15 minutes and try again."));
  authAttempts.set(key, [...recent, now]);
  next();
};

export const resetAuthRateLimit = () => authAttempts.clear();
