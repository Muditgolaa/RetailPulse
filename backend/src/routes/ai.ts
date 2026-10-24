import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/middleware.js";
import { HttpError } from "../lib/http.js";
import { recommend } from "../recommend/service.js";
import { ask } from "../rag/answer.js";
import { DOC_TYPES } from "../rag/ingest.js";
import { readPreferences } from "../users/preferences.js";
import { aiRateLimit } from "../lib/rateLimit.js";

export const aiRouter = Router();
aiRouter.use(requireAuth);


const recommendBody = z.object({
  query: z.string().trim().min(3, "Describe what you are looking for").max(500),
  storeId: z.number().int().positive().optional(),
});

// Strict: region, tier, dates or user fields in the body are rejected, so access filters can't be overridden.
const askBody = z
  .object({
    question: z.string().trim().min(3, "Ask a question").max(500),
    docType: z.enum(DOC_TYPES).optional(),
    category: z.string().regex(/^[A-Za-z &]{2,40}$/).optional(),
  })
  .strict();

aiRouter.post("/ask", aiRateLimit, async (req, res) => {
  const { question, ...narrow } = askBody.parse(req.body);
  const viewer = { country: req.user!.country, membershipTier: req.user!.membershipTier }; // from the database
  res.json(await ask(question, viewer, narrow, req.user!.id));
});

aiRouter.post("/recommend", aiRateLimit, async (req, res) => {
  const { query, storeId: requested } = recommendBody.parse(req.body);
  const storeId = requested ?? req.user!.preferredStoreId ?? 1;
  if (!(await prisma.store.findUnique({ where: { id: storeId } }))) throw new HttpError(400, "Unknown storeId");
  res.json(await recommend(query, storeId, req.user!.id, readPreferences(req.user!.preferences)));
});
