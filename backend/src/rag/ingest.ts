// Ingestion: markdown policy files → section chunks with metadata → embeddings → knowledge_chunks.
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { prisma } from "../db.js";
import { embed, toVectorLiteral } from "./embed.js";

const TIERS = ["ALL", "STANDARD", "SILVER", "GOLD", "PLATINUM"] as const;
const MAX_CHUNK_WORDS = 220;

const frontMatterSchema = z.object({
  docId: z.string().regex(/^[a-z0-9-]{3,80}$/),
  title: z.string().min(1).max(160),
  docType: z.string().regex(/^[A-Z_]{2,30}$/),
  version: z.string().min(1).max(20),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  region: z.string().length(2),
  tier: z.enum(TIERS),
  category: z.string().max(40),
});
export type DocMeta = z.infer<typeof frontMatterSchema>;

export type Chunk = DocMeta & { section: string; chunkIndex: number; content: string; contentHash: string };

// Front matter is simple "key: value" lines between --- markers.
export function parseDocument(text: string): { meta: DocMeta; body: string } | null {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  const raw = Object.fromEntries(
    m[1].split("\n").filter((l) => l.includes(":")).map((l) => {
      const i = l.indexOf(":");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"(.*)"$/, "$1")];
    }),
  );
  if (!raw.docId) return null;
  return { meta: frontMatterSchema.parse(raw), body: m[2] };
}

// One chunk per "## " section (long sections split by paragraph). A "<!-- tier: X -->" line overrides the tier.
export function chunkDocument(meta: DocMeta, body: string): Chunk[] {
  const chunks: Chunk[] = [];
  for (const part of body.split(/^## /m).slice(1)) {
    const [headingLine, ...rest] = part.split("\n");
    const section = headingLine.trim();
    const tierMarker = rest.join("\n").match(/<!--\s*tier:\s*([A-Z]+)\s*-->/)?.[1];
    const tier = tierMarker && (TIERS as readonly string[]).includes(tierMarker) ? (tierMarker as DocMeta["tier"]) : meta.tier;
    const text = rest.join("\n").replace(/<!--[\s\S]*?-->/g, "").trim();
    if (!text) continue;

    for (const piece of splitLong(text)) {
      // Title and section are part of the embedded text so short chunks still carry their topic.
      const content = `${meta.title} › ${section}\n\n${piece}`;
      chunks.push({ ...meta, tier, section, chunkIndex: chunks.length, content, contentHash: createHash("sha256").update(content).digest("hex") });
    }
  }
  return chunks;
}

function splitLong(text: string): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  const out: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    const next = current ? `${current}\n\n${p}` : p;
    if (current && next.split(/\s+/).length > MAX_CHUNK_WORDS) {
      out.push(current);
      current = p;
    } else current = next;
  }
  if (current) out.push(current);
  return out;
}

// Replaces all chunks of one document (any older version) inside a transaction.
export async function storeChunks(documentId: string, chunks: Chunk[]): Promise<number> {
  const vectors = await embed(chunks.map((c) => c.content));
  await prisma.$transaction([
    prisma.knowledgeChunk.deleteMany({ where: { documentId } }),
    ...chunks.map((c, i) => prisma.$executeRaw`
      INSERT INTO knowledge_chunks
        (id, "documentId", "documentTitle", "docType", section, version, "effectiveDate", region, category, tier,
         "chunkIndex", content, "contentHash", embedding)
      VALUES (gen_random_uuid(), ${c.docId}, ${c.title}, ${c.docType}, ${c.section}, ${c.version}, ${c.effectiveDate}::date,
              ${c.region}, ${c.category}, ${c.tier}, ${c.chunkIndex}, ${c.content}, ${c.contentHash},
              ${toVectorLiteral(vectors[i])}::vector)`),
  ]);
  return chunks.length;
}

export async function ingestFolder(folder: string) {
  const files = (await readdir(folder)).filter((f) => f.endsWith(".md")).sort();
  const results: { file: string; documentId: string; chunks: number; skipped?: string }[] = [];
  for (const file of files) {
    const doc = parseDocument(await readFile(path.join(folder, file), "utf8"));
    if (!doc) {
      results.push({ file, documentId: "-", chunks: 0, skipped: "no docId front matter" });
      continue;
    }
    const chunks = chunkDocument(doc.meta, doc.body);
    const existing = await prisma.knowledgeChunk.findMany({ where: { documentId: doc.meta.docId }, select: { contentHash: true }, orderBy: { chunkIndex: "asc" } });
    const unchanged = existing.length === chunks.length && existing.every((e, i) => e.contentHash === chunks[i].contentHash);
    if (unchanged) {
      results.push({ file, documentId: doc.meta.docId, chunks: chunks.length, skipped: "unchanged" });
      continue;
    }
    results.push({ file, documentId: doc.meta.docId, chunks: await storeChunks(doc.meta.docId, chunks) });
  }
  return results;
}
