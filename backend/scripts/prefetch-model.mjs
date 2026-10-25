// Downloads the embedding model at image build time, so the server never downloads it on first request.
// Uses the same defaults as src/config/env.ts (EMBEDDING_MODEL, MODEL_CACHE_DIR).
import path from "node:path";
import { env, pipeline } from "@huggingface/transformers";

const model = process.env.EMBEDDING_MODEL ?? "Xenova/all-MiniLM-L6-v2";
env.cacheDir = path.resolve(process.env.MODEL_CACHE_DIR ?? ".cache/models");

const extract = await pipeline("feature-extraction", model, { dtype: "q8" });
const [vector] = (await extract(["warm-up"], { pooling: "mean", normalize: true })).tolist();
console.log(`Cached ${model} in ${env.cacheDir} (${vector.length} dimensions)`);
