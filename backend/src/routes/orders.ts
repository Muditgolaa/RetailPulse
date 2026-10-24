import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { cancelOrder, getOrder, listOrders, placeOrder } from "../orders/service.js";

// Customers only. The customer always comes from the verified token, never from the request.
export const ordersRouter = Router();
ordersRouter.use(requireAuth, requireRole("CUSTOMER"));

const orderBody = z
  .object({
    storeId: z.number().int().positive(),
    fulfilment: z.enum(["PICKUP", "DELIVERY"]),
    items: z
      .array(z.object({ sku: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{1,20}$/), qty: z.number().int().min(1).max(10) }).strict())
      .min(1, "The cart is empty")
      .max(20)
      .refine((items) => new Set(items.map((i) => i.sku)).size === items.length, "Each product can appear only once"),
  })
  .strict(); // prices, totals and user ids are never accepted from the client

const codeParam = z.string().trim().toUpperCase().regex(/^ORD-\d{1,8}$/, "Invalid order code");
const customer = (req: Express.Request) => ({ id: req.user!.id, email: req.user!.email, membershipTier: req.user!.membershipTier });

ordersRouter.post("/", async (req, res) => {
  res.status(201).json(await placeOrder(orderBody.parse(req.body), customer(req)));
});

ordersRouter.get("/", async (req, res) => {
  res.json(await listOrders(req.user!.id));
});

ordersRouter.get("/:code", async (req, res) => {
  res.json(await getOrder(codeParam.parse(req.params.code), req.user!.id));
});

ordersRouter.post("/:code/cancel", async (req, res) => {
  res.json(await cancelOrder(codeParam.parse(req.params.code), customer(req)));
});
