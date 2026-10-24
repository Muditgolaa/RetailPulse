// Managing the knowledge base from the app: managers upload Markdown or plain-text policies, which are
// chunked, embedded and searchable straight away. Uploads use the same chunking as `npm run kb:ingest`.
import { z } from "zod";
import { prisma } from "../db.js";
import { HttpError } from "../lib/http.js";
import { chunkDocument, DOC_TYPES, storeChunks, TIERS } from "./ingest.js";

export type Manager = { id: number; email: string };

const MAX_CONTENT_CHARS = 100_000;

export const uploadInput = z
  .object({
    title: z.string().trim().min(3).max(160),
    docType: z.enum(DOC_TYPES),
    version: z.string().trim().regex(/^[\w.-]{1,20}$/, "Use letters, numbers, dots or dashes, e.g. 2026.3"),
    effectiveDate: z.iso.date(),
    region: z.string().trim().toUpperCase().length(2).default("IN"),
    tier: z.enum(TIERS).default("ALL"),
    category: z.string().trim().max(40).default("ALL"),
    content: z.string().min(20, "The document is empty").max(MAX_CONTENT_CHARS, "The document is larger than 100,000 characters"),
  })
  .strict();
export type UploadInput = z.infer<typeof uploadInput>;

// "Gift Wrapping & Store Services" → "gift-wrapping-store-services"
export const slugify = (title: string) => title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

// Drops a leading YAML front matter block (the form supplies the metadata) and makes sure there is at least
// one "## " section, so plain text without headings becomes a single "Overview" section.
export function prepareBody(content: string): string {
  const body = content.replace(/\r\n/g, "\n").replace(/^---\n[\s\S]*?\n---\n/, "").trim();
  return /^## /m.test(body) ? body : `## Overview\n\n${body.replace(/^# .*\n+/, "")}`;
}

export async function uploadDocument(input: UploadInput, manager: Manager) {
  const documentId = slugify(input.title);
  if (documentId.length < 3) throw new HttpError(400, "The title needs some letters or numbers");

  const meta = { docId: documentId, ...input };
  const chunks = chunkDocument(meta, prepareBody(input.content));
  if (chunks.length === 0) throw new HttpError(400, "No text found under the document's headings");

  const existing = await prisma.knowledgeChunk.findMany({ where: { documentId }, select: { contentHash: true, version: true }, orderBy: { chunkIndex: "asc" } });
  const unchanged = existing.length === chunks.length && existing.every((e, i) => e.contentHash === chunks[i].contentHash && e.version === input.version);
  if (!unchanged) await storeChunks(documentId, chunks); // replaces any earlier version

  await prisma.auditLog.create({
    data: {
      actorId: manager.id, actorEmail: manager.email, action: "KB_DOCUMENT_UPLOADED", entity: "knowledge_document", entityId: documentId,
      details: { title: input.title, version: input.version, chunks: chunks.length, replacedVersion: existing[0]?.version ?? null, unchanged },
    },
  });
  return {
    documentId, title: input.title, version: input.version, chunks: chunks.length, unchanged,
    replacedVersion: existing.length && !unchanged ? existing[0].version : null,
    sections: [...new Set(chunks.map((c) => c.section))],
  };
}

type DocumentRow = {
  documentId: string; title: string; docType: string; version: string; effectiveDate: Date; region: string;
  category: string | null; tiers: string[]; sections: string[]; chunks: number; updatedAt: Date;
};

// One row per document, built from its chunks.
export async function listDocuments() {
  const rows = await prisma.$queryRaw<DocumentRow[]>`
    SELECT "documentId", MIN("documentTitle") AS title, MIN("docType") AS "docType", MIN(version) AS version,
           MIN("effectiveDate") AS "effectiveDate", MIN(region) AS region, MIN(category) AS category,
           ARRAY_AGG(DISTINCT tier) AS tiers, ARRAY_AGG(DISTINCT section) AS sections,
           COUNT(*)::int AS chunks, MAX("createdAt") AS "updatedAt"
    FROM knowledge_chunks
    GROUP BY "documentId"
    ORDER BY MIN("documentTitle")`;
  return rows.map((r) => ({ ...r, effectiveDate: r.effectiveDate.toISOString().slice(0, 10) }));
}

export async function deleteDocument(documentId: string, manager: Manager) {
  const { count } = await prisma.knowledgeChunk.deleteMany({ where: { documentId } });
  if (count === 0) throw new HttpError(404, "Document not found");
  await prisma.auditLog.create({
    data: { actorId: manager.id, actorEmail: manager.email, action: "KB_DOCUMENT_DELETED", entity: "knowledge_document", entityId: documentId, details: { chunks: count } },
  });
  return { documentId, deletedChunks: count };
}
