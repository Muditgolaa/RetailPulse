// Local sentence embeddings (all-MiniLM-L6-v2, 384 dimensions). Runs in-process: no API key, no per-call cost.
// The model is downloaded once into MODEL_CACHE_DIR on first use.
import path from "node:path";
import { env } from "../config/env.js";

export const EMBEDDING_DIMENSIONS = 384;

type Extractor = (texts: string[], opts: { pooling: "mean"; normalize: boolean }) => Promise<{ tolist(): number[][] }>;
let extractor: Promise<Extractor> | null = null;

function load(): Promise<Extractor> {
  extractor ??= (async () => {
    const hf = await import("@huggingface/transformers");
    hf.env.cacheDir = path.resolve(env.MODEL_CACHE_DIR);
    return (await hf.pipeline("feature-extraction", env.EMBEDDING_MODEL, { dtype: "q8" })) as unknown as Extractor;
  })();
  extractor.catch(() => (extractor = null)); // allow a retry after a failed download
  return extractor;
}

// Unit-length vectors, so cosine similarity = dot product.
export async function embed(texts: string[]): Promise<number[][]> {
  const model = await load();
  const vectors = (await model(texts, { pooling: "mean", normalize: true })).tolist();
  if (vectors.some((v) => v.length !== EMBEDDING_DIMENSIONS)) throw new Error(`Embedding model must return ${EMBEDDING_DIMENSIONS} dimensions`);
  return vectors;
}

// pgvector text format: [0.1,0.2,...]
export const toVectorLiteral = (v: number[]) => `[${v.map((x) => x.toFixed(6)).join(",")}]`;
