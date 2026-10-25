import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db.js";
import { env } from "../config/env.js";
import { signToken } from "../auth/jwt.js";
import { publicUserSelect, requireAuth } from "../auth/middleware.js";
import { HttpError } from "../lib/http.js";
import { authRateLimit } from "../lib/rateLimit.js";
import { getSettings } from "../settings/service.js";

export const authRouter = Router();

const BCRYPT_ROUNDS = 10;
const DEFAULT_STORE_CODE = "DEL01";

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(120);
const loginBody = z.object({ email, password: z.string().min(1).max(200) });
const registerBody = z
  .object({
    name: z.string().trim().min(2, "Enter your name").max(80),
    email,
    password: z.string().min(8, "Use at least 8 characters").max(200),
  })
  .strict(); // role, tier and similar fields can never be chosen by the person signing up

// A real hash of a random string, so unknown emails take as long as wrong passwords.
const DUMMY_HASH = bcrypt.hashSync("timing-equaliser-not-a-password", BCRYPT_ROUNDS);

const isAdminEmail = (address: string) => env.ADMIN_EMAILS.includes(address.toLowerCase());

// Emails listed in ADMIN_EMAILS become admins the next time they sign in.
async function promoteIfAdmin(user: { id: number; email: string; role: string }) {
  if (user.role === "ADMIN" || !isAdminEmail(user.email)) return;
  await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  await prisma.auditLog.create({
    data: { actorId: user.id, actorEmail: user.email, action: "USER_PROMOTED_TO_ADMIN", entity: "user", entityId: String(user.id), details: { via: "ADMIN_EMAILS" } },
  });
}

const session = async (userId: number) => ({
  token: signToken(userId),
  user: await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: publicUserSelect }),
});

authRouter.post("/login", authRateLimit, async (req, res) => {
  const { email: address, password } = loginBody.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: address } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, "Invalid email or password");

  await promoteIfAdmin(user);
  res.json(await session(user.id));
});

authRouter.post("/register", authRateLimit, async (req, res) => {
  const input = registerBody.parse(req.body);
  if (!(await getSettings()).signupEnabled && !isAdminEmail(input.email)) throw new HttpError(403, "New sign-ups are closed right now.");
  if (await prisma.user.findUnique({ where: { email: input.email } })) {
    throw new HttpError(409, "An account with this email already exists. Sign in instead.");
  }

  const store = await prisma.store.findUnique({ where: { code: DEFAULT_STORE_CODE } });
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
      role: isAdminEmail(input.email) ? "ADMIN" : "CUSTOMER",
      membershipTier: "STANDARD",
      preferredStoreId: store?.id ?? null,
      preferences: { brands: [], maxBudget: null },
    },
  });
  await prisma.auditLog.create({
    data: { actorId: user.id, actorEmail: user.email, action: "USER_REGISTERED", entity: "user", entityId: String(user.id), details: { role: user.role } },
  });
  res.status(201).json(await session(user.id));
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ── One-click demo sign-in ───────────────────────────────────────────────────
// Issues a normal token for one of the two seeded demo accounts, without a password.
// Admins switch it on or off from the website (Admin → Site settings).
const DEMO_ACCOUNTS = { customer: "priya@novamart.test", manager: "rahul@novamart.test" } as const;
const demoBody = z.object({ account: z.enum(["customer", "manager"]) });

authRouter.post("/demo", async (req, res) => {
  if (!(await getSettings()).demoAccess) throw new HttpError(403, "Demo access is turned off. Sign in or create an account.");
  const { account } = demoBody.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: DEMO_ACCOUNTS[account] }, select: publicUserSelect });
  if (!user) throw new HttpError(404, "Demo account not found. Run npm run db:seed.");
  res.json({ token: signToken(user.id), user, demo: true });
});
