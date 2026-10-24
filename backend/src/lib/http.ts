import type { ErrorRequestHandler, RequestHandler } from "express";
import { z } from "zod";
import { AiProviderError } from "../ai/groq.js";

// Throw this from any route to send a specific status with a JSON error body.
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not found" });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: "Invalid request", details: z.flattenError(err).fieldErrors });
    return;
  }
  if (err instanceof AiProviderError) {
    if (err.retryAfterSeconds) res.setHeader("Retry-After", String(err.retryAfterSeconds));
    res.status(err.httpStatus).json({ error: "The AI service is unavailable right now", reason: err.kind });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // Malformed JSON body from express.json()
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Request body must be valid JSON" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};
