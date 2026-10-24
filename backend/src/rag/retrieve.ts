// pgvector retrieval with access filters built only from the verified user, never from the request text.
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../db.js";
import { env } from "../config/env.js";
import { embed, toVectorLiteral } from "./embed.js";

export type Viewer = { country: string; membershipTier: string };
export type Narrowing = { docType?: string; category?: string }; // optional, can only narrow results

export type RetrievedChunk = {
  id: string; documentId: string; documentTitle: string; docType: string; section: string; version: string;
  effectiveDate: Date; tier: string; content: string; similarity: number;
};

export async function retrieve(question: string, viewer: Viewer, narrow: Narrowing = {}, topK = env.RAG_TOP_K) {
  const [vector] = await embed([question]);
  const q = `${toVectorLiteral(vector)}`;

  const rows = await prisma.$queryRaw<RetrievedChunk[]>`
    SELECT id, "documentId", "documentTitle", "docType", section, version, "effectiveDate", tier, content,
           1 - (embedding <=> ${q}::vector) AS similarity
    FROM knowledge_chunks
    WHERE embedding IS NOT NULL
      AND region = ${viewer.country}
      AND tier IN ('ALL', ${viewer.membershipTier})
      AND "effectiveDate" <= CURRENT_DATE
      ${narrow.docType ? Prisma.sql`AND "docType" = ${narrow.docType}` : Prisma.empty}
      ${narrow.category ? Prisma.sql`AND (category = ${narrow.category} OR category = 'ALL')` : Prisma.empty}
    ORDER BY embedding <=> ${q}::vector
    LIMIT ${topK}`;

  const all = rows.map((r) => ({ ...r, similarity: Number(r.similarity) }));
  return { evidence: all.filter((r) => r.similarity >= env.RAG_MIN_SIMILARITY), nearest: all };
}
