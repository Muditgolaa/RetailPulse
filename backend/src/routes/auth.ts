import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db.js";
import { env } from "../config/env.js";
import { signToken } from "../auth/jwt.js";
import { publicUserSelect, requireAuth } from "../auth/middleware.js";
import { HttpError } from "../lib/http.js";

export const authRouter = Router();

const loginBody = z.object({
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(1).max(200),
});

// A real hash of a random string, so unknown emails take as long as wrong passwords.
const DUMMY_HASH = bcrypt.hashSync("timing-equaliser-not-a-password", 10);

authRouter.post("/login", async (req, res) => {
  const { email, password } = loginBody.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, "Invalid email or password");

  const { passwordHash: _omit, createdAt: _c, updatedAt: _u, ...publicUser } = user;
  res.json({ token: signToken(user.id), user: publicUser });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ── Temporary hackathon demo sign-in ─────────────────────────────────────────
// Issues a normal token for one of the two seeded demo accounts, without a password.
// Only exists when DEMO_LOGIN_ENABLED=true and NODE_ENV is not production.
const DEMO_ACCOUNTS = { customer: "priya@novamart.test", manager: "rahul@novamart.test" } as const;
const demoBody = z.object({ account: z.enum(["customer", "manager"]) });

authRouter.post("/demo", async (req, res) => {
  if (!env.DEMO_LOGIN_ENABLED) throw new HttpError(404, "Not found");
  const { account } = demoBody.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: DEMO_ACCOUNTS[account] }, select: publicUserSelect });
  if (!user) throw new HttpError(404, "Demo account not found. Run npm run db:seed.");
  res.json({ token: signToken(user.id), user, demo: true });
});
