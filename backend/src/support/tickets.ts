// Support tickets: created by customers (or the support agent for them), handled by managers.
import { z } from "zod";
import { prisma } from "../db.js";
import { HttpError } from "../lib/http.js";

export const CATEGORIES = ["ORDER", "DELIVERY", "RETURN_REFUND", "PRODUCT", "PAYMENT", "OTHER"] as const;
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED"] as const;

const MAX_TICKETS_PER_HOUR = 3; // stops a customer (or a confused agent) flooding the queue

export type Viewer = { id: number; email: string; role: "CUSTOMER" | "MANAGER" };

export const ticketInput = z
  .object({
    category: z.enum(CATEGORIES),
    priority: z.enum(PRIORITIES).default("MEDIUM"),
    summary: z.string().trim().min(10, "Describe the problem in a sentence or two").max(500),
    orderCode: z.string().trim().toUpperCase().regex(/^ORD-\d{1,8}$/, "Invalid order code").optional(),
  })
  .strict();
export type TicketInput = z.infer<typeof ticketInput>;

const ticketInclude = {
  order: { select: { code: true, status: true } },
  user: { select: { name: true, email: true, membershipTier: true } },
} as const;

export async function createTicket(customer: Viewer, input: TicketInput, createdBy: "CUSTOMER" | "AGENT") {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  if ((await prisma.supportTicket.count({ where: { userId: customer.id, createdAt: { gte: since } } })) >= MAX_TICKETS_PER_HOUR) {
    throw new HttpError(429, "You've opened several tickets in the last hour. Our team will get back to you on those first.");
  }

  let orderId: number | null = null;
  if (input.orderCode) {
    const order = await prisma.order.findFirst({ where: { code: input.orderCode, userId: customer.id }, select: { id: true } });
    if (!order) throw new HttpError(404, "Order not found");
    orderId = order.id;
  }

  const ticket = await prisma.supportTicket.create({
    data: { userId: customer.id, orderId, category: input.category, priority: input.priority, summary: input.summary, createdBy },
    include: ticketInclude,
  });
  await prisma.auditLog.create({
    data: {
      actorId: customer.id, actorEmail: customer.email, action: "TICKET_CREATED", entity: "support_ticket", entityId: String(ticket.id),
      details: { category: ticket.category, priority: ticket.priority, orderCode: input.orderCode ?? null, createdBy },
    },
  });
  return ticket;
}

// Customers see their own tickets; managers see everyone's.
export function listTickets(viewer: Viewer, status?: (typeof STATUSES)[number]) {
  return prisma.supportTicket.findMany({
    where: { ...(viewer.role === "CUSTOMER" && { userId: viewer.id }), status },
    include: ticketInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
  });
}

export async function updateTicketStatus(id: number, status: (typeof STATUSES)[number], manager: Viewer) {
  const existing = await prisma.supportTicket.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Ticket not found");
  if (existing.status === status) throw new HttpError(409, `Ticket is already ${status.toLowerCase().replace("_", " ")}`);

  const ticket = await prisma.supportTicket.update({ where: { id }, data: { status }, include: ticketInclude });
  await prisma.auditLog.create({
    data: {
      actorId: manager.id, actorEmail: manager.email, action: "TICKET_STATUS_CHANGED", entity: "support_ticket", entityId: String(id),
      details: { from: existing.status, to: status },
    },
  });
  return ticket;
}
