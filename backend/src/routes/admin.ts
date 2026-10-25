import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { HttpError } from "../lib/http.js";
import { getSettings, settingsSchema, updateSettings } from "../settings/service.js";

// Settings anyone can read (the login page needs them before sign-in).
export const publicSettingsRouter = Router();
publicSettingsRouter.get("/", async (_req, res) => {
  res.json(await getSettings());
});

// Admin only: site settings and user accounts.
export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("ADMIN"));

const admin = (req: Express.Request) => ({ id: req.user!.id, email: req.user!.email });

adminRouter.get("/settings", async (_req, res) => {
  res.json(await getSettings());
});

adminRouter.put("/settings", async (req, res) => {
  const changes = settingsSchema.partial().strict().parse(req.body);
  res.json(await updateSettings(changes, admin(req)));
});

const userListSelect = {
  id: true, email: true, name: true, role: true, membershipTier: true, createdAt: true,
  _count: { select: { orders: true, tickets: true } },
} as const;

adminRouter.get("/users", async (req, res) => {
  const { q } = z.object({ q: z.string().trim().max(120).optional() }).parse(req.query);
  const users = await prisma.user.findMany({
    where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : undefined,
    select: userListSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200,
  });
  res.json(users);
});

const userChanges = z
  .object({
    role: z.enum(["CUSTOMER", "MANAGER", "ADMIN"]).optional(),
    membershipTier: z.enum(["STANDARD", "SILVER", "GOLD", "PLATINUM"]).optional(),
  })
  .strict()
  .refine((v) => v.role || v.membershipTier, "Nothing to change");

adminRouter.patch("/users/:id", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const changes = userChanges.parse(req.body);
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new HttpError(404, "User not found");

  // Keep at least one admin, and stop admins from accidentally removing their own access.
  if (changes.role && changes.role !== "ADMIN" && target.role === "ADMIN") {
    if (target.id === req.user!.id) throw new HttpError(409, "You can't remove your own admin access.");
    if ((await prisma.user.count({ where: { role: "ADMIN" } })) <= 1) throw new HttpError(409, "There must always be at least one admin.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id }, data: changes, select: userListSelect });
    await tx.auditLog.create({
      data: {
        actorId: req.user!.id, actorEmail: req.user!.email, action: "USER_UPDATED", entity: "user", entityId: String(id),
        details: { email: target.email, before: { role: target.role, membershipTier: target.membershipTier }, changes },
      },
    });
    return user;
  });
  res.json(updated);
});
