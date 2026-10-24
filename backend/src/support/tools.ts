// Tools the support agent may ask for. Each one runs here, as the signed-in customer: the model only
// chooses a tool and its arguments, and every argument is validated before anything runs.
// There are deliberately no tools for refunds, cancellations or price changes.
import { z } from "zod";
import type { ToolDefinition } from "../ai/groq.js";
import { HttpError } from "../lib/http.js";
import { getOrder, listOrders } from "../orders/service.js";
import { retrieve } from "../rag/retrieve.js";
import { CATEGORIES, createTicket, PRIORITIES, ticketInput } from "./tickets.js";

export type Customer = { id: number; email: string; country: string; membershipTier: string };
export type ToolOutcome = { result: unknown; summary: string; ticket?: { id: number; category: string; priority: string; status: string } };

type Tool = { definition: ToolDefinition; run: (args: unknown, customer: Customer) => Promise<ToolOutcome> };

const orderCode = z.string().trim().toUpperCase().regex(/^ORD-\d{1,8}$/);

// Only the fields a support conversation needs.
const orderSummary = (o: Awaited<ReturnType<typeof getOrder>>) => ({
  code: o.code, status: o.status, statusNote: o.statusNote, fulfilment: o.fulfilment, store: o.store.name,
  total: o.total, placedOn: o.createdAt, expectedDeliveryAt: o.expectedDeliveryAt, deliveredAt: o.deliveredAt,
  items: o.items.map((i) => `${i.qty} × ${i.name}`),
});

export const TOOLS: Record<string, Tool> = {
  get_order_status: {
    definition: {
      name: "get_order_status",
      description: "Look up one of the current customer's orders by its code, e.g. ORD-1023.",
      parameters: { type: "object", properties: { orderCode: { type: "string" } }, required: ["orderCode"], additionalProperties: false },
    },
    async run(args, customer) {
      const code = orderCode.parse((args as { orderCode?: unknown }).orderCode);
      try {
        return { result: orderSummary(await getOrder(code, customer.id)), summary: `Checked order ${code}` };
      } catch (err) {
        if (err instanceof HttpError && err.status === 404) return { result: { error: `No order ${code} on this account` }, summary: `Looked for order ${code}` };
        throw err;
      }
    },
  },

  list_my_orders: {
    definition: {
      name: "list_my_orders",
      description: "List the current customer's five most recent orders.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
    async run(_args, customer) {
      const orders = (await listOrders(customer.id)).slice(0, 5).map(orderSummary);
      return { result: orders, summary: "Listed your recent orders" };
    },
  },

  search_policy: {
    definition: {
      name: "search_policy",
      description: "Search NovaMart's approved policy documents (returns, warranty, delivery, payments, membership).",
      parameters: { type: "object", properties: { question: { type: "string" } }, required: ["question"], additionalProperties: false },
    },
    async run(args, customer) {
      const question = z.string().trim().min(3).max(300).parse((args as { question?: unknown }).question);
      // Same access filters as the policy assistant: region and tier come from the customer's account.
      const { evidence } = await retrieve(question, { country: customer.country, membershipTier: customer.membershipTier }, {}, 3);
      const result = evidence.length
        ? evidence.map((e) => ({ source: `${e.documentTitle} › ${e.section} (v${e.version})`, text: e.content.replace(/^.*\n\n/, "") }))
        : { error: "No approved policy covers this." };
      return { result, summary: "Searched NovaMart policies" };
    },
  },

  create_ticket: {
    definition: {
      name: "create_ticket",
      description: "Open a support ticket so a NovaMart staff member follows up. Use when the customer asks for a person or the issue can't be solved here.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", enum: [...CATEGORIES] },
          priority: { type: "string", enum: [...PRIORITIES] },
          summary: { type: "string", description: "One or two sentences describing the problem for the support team." },
          orderCode: { type: "string", description: "The related order code, if any." },
        },
        required: ["category", "summary"],
        additionalProperties: false,
      },
    },
    async run(args, customer) {
      const input = ticketInput.parse(args);
      try {
        const t = await createTicket({ id: customer.id, email: customer.email, role: "CUSTOMER" }, input, "AGENT");
        const ticket = { id: t.id, category: t.category, priority: t.priority, status: t.status };
        return { result: { created: true, ticketId: t.id, ...ticket }, summary: `Opened ticket #${t.id}`, ticket };
      } catch (err) {
        if (err instanceof HttpError && (err.status === 429 || err.status === 404)) return { result: { error: err.message }, summary: "Couldn't open a ticket" };
        throw err;
      }
    },
  },
};

export const TOOL_DEFINITIONS = Object.values(TOOLS).map((t) => t.definition);
