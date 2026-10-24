import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { aiRateLimit } from "../lib/rateLimit.js";
import { historySchema, runSupportAgent } from "../support/agent.js";
import { createTicket, listTickets, STATUSES, ticketInput, updateTicketStatus } from "../support/tickets.js";

export const supportRouter = Router();
supportRouter.use(requireAuth);

const viewer = (req: Express.Request) => ({ id: req.user!.id, email: req.user!.email, role: req.user!.role });

const chatBody = z
  .object({ message: z.string().trim().min(2, "Type a message").max(1000), history: historySchema.default([]) })
  .strict();

supportRouter.post("/chat", requireRole("CUSTOMER"), aiRateLimit, async (req, res) => {
  const { message, history } = chatBody.parse(req.body);
  const u = req.user!;
  res.json(await runSupportAgent(message, history, { id: u.id, email: u.email, country: u.country, membershipTier: u.membershipTier }));
});

supportRouter.post("/tickets", requireRole("CUSTOMER"), async (req, res) => {
  res.status(201).json(await createTicket(viewer(req), ticketInput.parse(req.body), "CUSTOMER"));
});

supportRouter.get("/tickets", async (req, res) => {
  const { status } = z.object({ status: z.enum(STATUSES).optional() }).parse(req.query);
  res.json(await listTickets(viewer(req), status));
});

supportRouter.patch("/tickets/:id", requireRole("MANAGER"), async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const { status } = z.object({ status: z.enum(STATUSES) }).strict().parse(req.body);
  res.json(await updateTicketStatus(id, status, viewer(req)));
});
