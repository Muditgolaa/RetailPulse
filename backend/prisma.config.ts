import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer reads .env by itself.
try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on variables already set in the shell.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  // Prisma 7 never seeds automatically; run `npm run db:seed` (or `db:reset`) explicitly.
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: env("DATABASE_URL") },
});
