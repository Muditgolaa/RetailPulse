// Customer shopping preferences, stored in users.preferences (JSON) and users.preferredStoreId.
import { z } from "zod";
import { prisma } from "../db.js";
import { publicUserSelect } from "../auth/middleware.js";
import { HttpError } from "../lib/http.js";

export type Preferences = { brands: string[]; maxBudget: number | null };

const MAX_BRANDS = 5;
const BUDGET_MIN = 500;
const BUDGET_MAX = 1_000_000;

// Reading is forgiving, so older or partial JSON in the database never breaks a request.
const storedSchema = z.object({
  brands: z.array(z.string()).catch([]),
  maxBudget: z.number().positive().nullable().catch(null),
});

export function readPreferences(raw: unknown): Preferences {
  const parsed = storedSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : { brands: [], maxBudget: null };
}

export const preferencesBody = z
  .object({
    preferredStoreId: z.number().int().positive().nullable(),
    brands: z.array(z.string().trim().min(1).max(40)).max(MAX_BRANDS, `Choose up to ${MAX_BRANDS} brands`),
    maxBudget: z.number().int().min(BUDGET_MIN).max(BUDGET_MAX).nullable(),
  })
  .strict();

export async function updatePreferences(userId: number, input: z.infer<typeof preferencesBody>) {
  if (input.preferredStoreId !== null && !(await prisma.store.findUnique({ where: { id: input.preferredStoreId } }))) {
    throw new HttpError(400, "Unknown store");
  }

  // Brands must exist in the catalogue; matching ignores case and stores the catalogue spelling.
  const catalogBrands = (await prisma.product.findMany({ where: { active: true }, distinct: ["brand"], select: { brand: true } })).map((b) => b.brand);
  const brands: string[] = [];
  for (const requested of input.brands) {
    const match = catalogBrands.find((b) => b.toLowerCase() === requested.toLowerCase());
    if (!match) throw new HttpError(400, `Unknown brand: ${requested}`);
    if (!brands.includes(match)) brands.push(match);
  }

  return prisma.user.update({
    where: { id: userId },
    data: { preferredStoreId: input.preferredStoreId, preferences: { brands, maxBudget: input.maxBudget } },
    select: publicUserSelect,
  });
}
