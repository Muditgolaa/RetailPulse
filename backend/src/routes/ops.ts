import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { HttpError } from "../lib/http.js";
import { dashboard, decide, listActions, listAudit, scanStore } from "../inventory/service.js";

// Everything under /api/ops is for store managers only (checked on the server).
export const opsRouter = Router();
opsRouter.use(requireAuth, requireRole("MANAGER"));

const storeQuery = z.object({ storeId: z.coerce.number().int().positive() });
const manager = (req: Express.Request) => ({ id: req.user!.id, email: req.user!.email });

async function requireStore(storeId: number) {
  if (!(await prisma.store.findUnique({ where: { id: storeId } }))) throw new HttpError(404, "Store not found");
}

opsRouter.get("/dashboard", async (req, res) => {
  const { storeId } = storeQuery.parse(req.query);
  await requireStore(storeId);
  res.json(await dashboard(storeId));
});

opsRouter.post("/scan", async (req, res) => {
  const { storeId } = z.object({ storeId: z.number().int().positive() }).strict().parse(req.body);
  await requireStore(storeId);
  res.status(201).json(await scanStore(storeId, manager(req)));
});

const actionsQuery = z.object({
  status: z.enum(["PROPOSED", "APPROVED", "REJECTED", "EXECUTED"]).optional(),
  storeId: z.coerce.number().int().positive().optional(),
});

opsRouter.get("/actions", async (req, res) => {
  res.json(await listActions(actionsQuery.parse(req.query)));
});

const idParam = z.coerce.number().int().positive();
const decisionBody = z.object({ note: z.string().trim().max(300).optional() }).strict();

for (const decision of ["approve", "reject"] as const) {
  opsRouter.post(`/actions/:id/${decision}`, async (req, res) => {
    const id = idParam.parse(req.params.id);
    const { note } = decisionBody.parse(req.body ?? {});
    res.json(await decide(id, decision, manager(req), note));
  });
}

opsRouter.get("/audit", async (req, res) => {
  const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }).parse(req.query);
  res.json(await listAudit(limit));
});
