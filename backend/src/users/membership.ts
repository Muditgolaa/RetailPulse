// Membership tiers, earned by spend in the last 12 months (Membership Benefits Policy, backend/knowledge/membership.md).
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../db.js";

export type Tier = "STANDARD" | "SILVER" | "GOLD" | "PLATINUM";
type Db = Prisma.TransactionClient | typeof prisma;

// Lowest tier first. Benefits mirror the policy document, so keep the two in step.
export const TIERS: { tier: Tier; minSpend: number; benefits: string[] }[] = [
  {
    tier: "STANDARD",
    minSpend: 0,
    benefits: [
      "1 NovaPoint for every ₹100 spent",
      "Free standard delivery on orders of ₹999 or more",
      "10-day return window",
      "Express delivery ₹149 in Delhi NCR",
    ],
  },
  {
    tier: "SILVER",
    minSpend: 25_000,
    benefits: ["2 NovaPoints for every ₹100 spent", "Free standard delivery on every order", "10-day return window", "Express delivery ₹149 in Delhi NCR"],
  },
  {
    tier: "GOLD",
    minSpend: 75_000,
    benefits: [
      "3 NovaPoints for every ₹100 spent",
      "Free standard delivery on every order",
      "Free express delivery on orders of ₹2,000 or more in Delhi NCR",
      "15-day return window (opened electronics excluded)",
      "Priority customer support",
    ],
  },
  {
    tier: "PLATINUM",
    minSpend: 200_000,
    benefits: [
      "5 NovaPoints for every ₹100 spent",
      "Free standard delivery on every order",
      "Free express delivery on every order in Delhi NCR",
      "30-day return window (opened electronics excluded)",
      "Free 1-year NovaCare extended warranty on large appliances",
      "Dedicated support phone line",
    ],
  },
];

const rank = (tier: string) => TIERS.findIndex((t) => t.tier === tier);
const YEAR_MS = 365 * 86_400_000;

export function tierForSpend(spend: number): Tier {
  return [...TIERS].reverse().find((t) => spend >= t.minSpend)!.tier;
}

// Cancelled orders don't count towards a tier.
export async function spendLast12Months(userId: number, db: Db = prisma): Promise<number> {
  const { _sum } = await db.order.aggregate({
    where: { userId, status: { not: "CANCELLED" }, createdAt: { gte: new Date(Date.now() - YEAR_MS) } },
    _sum: { total: true },
  });
  return Number(_sum.total ?? 0);
}

// Moves the customer up when their spend crosses a threshold. Never down: the policy only lowers tiers at the
// yearly review, and a tier an admin granted is kept.
export async function applyEarnedTier(customer: { id: number; email: string }, db: Db = prisma) {
  const [user, spend] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: customer.id }, select: { membershipTier: true } }),
    spendLast12Months(customer.id, db),
  ]);
  const earned = tierForSpend(spend);
  if (rank(earned) <= rank(user.membershipTier)) return null;

  await db.user.update({ where: { id: customer.id }, data: { membershipTier: earned } });
  await db.auditLog.create({
    data: {
      actorId: customer.id, actorEmail: customer.email, action: "MEMBERSHIP_UPGRADED", entity: "user", entityId: String(customer.id),
      details: { from: user.membershipTier, to: earned, spendLast12Months: spend },
    },
  });
  return { from: user.membershipTier as Tier, to: earned };
}

// Applies any tier already earned first, so spend from before tiers were automatic also counts.
export async function membershipSummary(customer: { id: number; email: string }) {
  await applyEarnedTier(customer);
  const [user, spend] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: customer.id }, select: { membershipTier: true } }),
    spendLast12Months(customer.id),
  ]);
  const next = TIERS.slice(rank(user.membershipTier) + 1).find((t) => t.minSpend > spend) ?? null;
  return {
    tier: user.membershipTier as Tier,
    spentLast12Months: spend,
    next: next && { tier: next.tier, minSpend: next.minSpend, remaining: next.minSpend - spend },
    tiers: TIERS,
  };
}
