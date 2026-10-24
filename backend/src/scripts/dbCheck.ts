// Checks the database connection and that the pgvector extension is installed.
import { prisma } from "../db.js";

try {
  const [{ version }] = await prisma.$queryRaw<{ version: string }[]>`SELECT version()`;
  const vector = await prisma.$queryRaw<{ extversion: string }[]>`
    SELECT extversion FROM pg_extension WHERE extname = 'vector'`;

  console.log("Connected:", version);
  if (vector.length === 0) {
    console.error("pgvector extension is NOT installed");
    process.exitCode = 1;
  } else {
    console.log("pgvector extension:", vector[0].extversion);
  }
} catch (err) {
  console.error("Database check failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
