import { z } from "zod";

try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on variables already set in the shell.
}

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  // POST /api/auth/demo signs in as a seeded demo account without a password. Off unless set; only enable it
  // for a public demo that holds fictional data (the demo accounts are shared by every visitor).
  DEMO_LOGIN_ENABLED: z.stringbool().default(false),
  // Production: folder with the built frontend (frontend/dist), served by Express on the same origin as /api.
  FRONTEND_DIST: z.string().optional(),
  // Groq (OpenAI-compatible API). Optional: without a key the app runs and AI features report "not configured".
  GROQ_API_KEY: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(20).optional()),
  GROQ_MODEL: z.string().min(1).default("openai/gpt-oss-120b"),
  GROQ_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(20000),
  // Policy assistant (RAG). Local embedding model, 384 dimensions to match knowledge_chunks.embedding.
  EMBEDDING_MODEL: z.string().default("Xenova/all-MiniLM-L6-v2"),
  MODEL_CACHE_DIR: z.string().default(".cache/models"),
  // Minimum cosine similarity for a chunk to count as evidence. A retrieval cut-off, not a probability of correctness.
  RAG_MIN_SIMILARITY: z.coerce.number().min(-1).max(1).default(0.45),
  RAG_TOP_K: z.coerce.number().int().min(1).max(10).default(4),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:", z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
