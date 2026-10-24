// Loads backend/knowledge/*.md into knowledge_chunks. Safe to re-run: unchanged documents are skipped.
// Run with `npm run kb:ingest`.
import path from "node:path";
import { ingestFolder } from "../rag/ingest.js";
import { prisma } from "../db.js";

try {
  const started = Date.now();
  const results = await ingestFolder(path.resolve("knowledge"));
  for (const r of results) console.log(`${r.file.padEnd(16)} ${r.documentId.padEnd(28)} ${String(r.chunks).padStart(2)} chunks ${r.skipped ? `(${r.skipped})` : "(ingested)"}`);
  const total = await prisma.knowledgeChunk.count();
  console.log(`\n${total} chunks in knowledge_chunks · ${Date.now() - started} ms`);
} catch (err) {
  console.error("Ingestion failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
