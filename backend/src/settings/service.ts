// Site settings that admins change from the website, stored in app_settings. Each setting has a default,
// so a fresh database works before anyone saves anything.
import { z } from "zod";
import { prisma } from "../db.js";
import { env } from "../config/env.js";

export const settingsSchema = z.object({
  demoAccess: z.boolean(), // one-click demo sign-in buttons and POST /api/auth/demo
  signupEnabled: z.boolean(), // anyone can create a customer account
});
export type Settings = z.infer<typeof settingsSchema>;

const defaults = (): Settings => ({ demoAccess: env.DEMO_LOGIN_ENABLED, signupEnabled: true });

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.appSetting.findMany();
  const saved = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const merged = { ...defaults(), ...saved };
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : defaults(); // a damaged row never takes the site down
}

export async function updateSettings(changes: Partial<Settings>, admin: { id: number; email: string }): Promise<Settings> {
  const before = await getSettings();
  await prisma.$transaction([
    ...Object.entries(changes).map(([key, value]) =>
      prisma.appSetting.upsert({ where: { key }, create: { key, value, updatedById: admin.id }, update: { value, updatedById: admin.id } }),
    ),
    prisma.auditLog.create({
      data: { actorId: admin.id, actorEmail: admin.email, action: "SETTINGS_CHANGED", entity: "app_settings", entityId: "site", details: { before, changes } },
    }),
  ]);
  return getSettings();
}
