// Minimal Groq client (OpenAI-compatible REST API). Backend only: the key never leaves this process.
import type { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../db.js";

const BASE_URL = "https://api.groq.com/openai/v1";

export type AiErrorKind = "NOT_CONFIGURED" | "AUTH" | "MODEL_NOT_FOUND" | "RATE_LIMITED" | "TIMEOUT" | "UNAVAILABLE" | "BAD_RESPONSE";

const HTTP_STATUS: Record<AiErrorKind, number> = {
  NOT_CONFIGURED: 503, AUTH: 503, MODEL_NOT_FOUND: 503, RATE_LIMITED: 429, TIMEOUT: 504, UNAVAILABLE: 503, BAD_RESPONSE: 502,
};

// Errors carry a safe message for clients; the key is scrubbed from anything that came from the provider.
export class AiProviderError extends Error {
  readonly httpStatus: number;
  constructor(public kind: AiErrorKind, message: string, public retryAfterSeconds?: number) {
    super(scrub(message));
    this.httpStatus = HTTP_STATUS[kind];
  }
}

function scrub(text: string): string {
  const key = env.GROQ_API_KEY;
  return key ? text.split(key).join("[redacted]") : text;
}

async function groqFetch(path: string, init: RequestInit = {}, timeoutMs = env.GROQ_TIMEOUT_MS): Promise<unknown> {
  if (!env.GROQ_API_KEY) throw new AiProviderError("NOT_CONFIGURED", "GROQ_API_KEY is not set in backend/.env");

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, "Content-Type": "application/json", ...init.headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new AiProviderError("TIMEOUT", `Groq did not respond within ${timeoutMs} ms`);
    }
    throw new AiProviderError("UNAVAILABLE", "Could not reach Groq (network error)");
  }

  const body = (await res.json().catch(() => null)) as { error?: { message?: string; code?: string } } | null;
  if (res.ok) return body;

  const detail = body?.error?.message ?? res.statusText;
  if (res.status === 401 || res.status === 403) throw new AiProviderError("AUTH", `Groq rejected the API key (${res.status})`);
  if (res.status === 404 || body?.error?.code === "model_not_found") throw new AiProviderError("MODEL_NOT_FOUND", `Groq model not available: ${detail}`);
  if (res.status === 429) {
    throw new AiProviderError("RATE_LIMITED", "Groq rate limit reached, try again shortly", Number(res.headers.get("retry-after")) || undefined);
  }
  if (res.status >= 500) throw new AiProviderError("UNAVAILABLE", `Groq is unavailable (${res.status})`);
  throw new AiProviderError("BAD_RESPONSE", `Groq request failed (${res.status}): ${detail}`);
}

const isReasoningModel = (model: string) => model.startsWith("openai/gpt-oss");

export async function listModels(timeoutMs = 8000): Promise<string[]> {
  const body = (await groqFetch("/models", { method: "GET" }, timeoutMs)) as { data?: { id: string }[] };
  return (body?.data ?? []).map((m) => m.id).sort();
}

export type ToolCall = { id: string; name: string; arguments: string };
export type ToolDefinition = { name: string; description: string; parameters: Record<string, unknown> };
export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };
export type ChatResult = {
  content: string; toolCalls: ToolCall[]; model: string; latencyMs: number; promptTokens?: number; completionTokens?: number;
};

type ChatOptions = {
  maxTokens?: number; temperature?: number; feature?: string; userId?: number; timeoutMs?: number; json?: boolean;
  tools?: ToolDefinition[]; // the model may ask for these; our code runs them, never the model
};

// Our message shape → the OpenAI-compatible wire format Groq expects.
function toWire(m: ChatMessage) {
  if (m.role === "tool") return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
  if (m.role === "assistant" && m.toolCalls?.length) {
    return {
      role: "assistant", content: m.content || null,
      tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.arguments } })),
    };
  }
  return { role: m.role, content: m.content };
}

// One chat completion. When `feature` is given, the call is recorded in ai_call_logs (never the prompt or key).
export async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
  const started = Date.now();
  try {
    const body = (await groqFetch(
      "/chat/completions",
      {
        method: "POST",
        body: JSON.stringify({
          model: env.GROQ_MODEL,
          messages: messages.map(toWire),
          max_tokens: opts.maxTokens ?? 512,
          temperature: opts.temperature ?? 0.2,
          // gpt-oss models reason before answering; keep that short so the token budget goes to the answer.
          ...(isReasoningModel(env.GROQ_MODEL) && { reasoning_effort: "low" }),
          ...(opts.json && { response_format: { type: "json_object" } }),
          ...(opts.tools?.length && {
            tools: opts.tools.map((t) => ({ type: "function", function: t })),
            tool_choice: "auto",
          }),
        }),
      },
      opts.timeoutMs,
    )) as {
      model?: string;
      choices?: {
        message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] };
        finish_reason?: string;
      }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const choice = body?.choices?.[0];
    const toolCalls = (choice?.message?.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function.name, arguments: c.function.arguments }));
    const content = choice?.message?.content ?? "";
    if (typeof content !== "string") throw new AiProviderError("BAD_RESPONSE", "Groq returned no message content");
    if (toolCalls.length === 0 && !content.trim()) {
      throw new AiProviderError("BAD_RESPONSE", choice?.finish_reason === "length"
        ? "Groq used the whole token budget before answering; raise maxTokens"
        : "Groq returned no message content");
    }

    const result = {
      content, toolCalls, model: body.model ?? env.GROQ_MODEL, latencyMs: Date.now() - started,
      promptTokens: body.usage?.prompt_tokens, completionTokens: body.usage?.completion_tokens,
    };
    await logCall(opts, result.latencyMs, true, undefined, result);
    return result;
  } catch (err) {
    const error = err instanceof AiProviderError ? err : new AiProviderError("BAD_RESPONSE", "Unexpected error calling Groq");
    await logCall(opts, Date.now() - started, false, `${error.kind}: ${error.message}`);
    throw error;
  }
}

// JSON-mode chat whose reply must match `schema`; anything else is a BAD_RESPONSE.
export async function chatJson<T>(messages: ChatMessage[], schema: z.ZodType<T>, opts: ChatOptions = {}): Promise<T> {
  const { content } = await chat(messages, { ...opts, json: true });
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AiProviderError("BAD_RESPONSE", "Groq returned invalid JSON");
  }
  const result = schema.safeParse(parsed);
  if (!result.success) throw new AiProviderError("BAD_RESPONSE", "Groq JSON did not match the expected shape");
  return result.data;
}

async function logCall(
  opts: { feature?: string; userId?: number }, latencyMs: number, success: boolean, error?: string, r?: ChatResult,
) {
  if (!opts.feature) return;
  await prisma.aiCallLog
    .create({
      data: {
        feature: opts.feature, model: r?.model ?? env.GROQ_MODEL, userId: opts.userId, latencyMs, success, error,
        promptTokens: r?.promptTokens, completionTokens: r?.completionTokens,
      },
    })
    .catch(() => {}); // logging must never break the request
}

export type AiHealth = {
  provider: "groq"; configured: boolean; reachable: boolean; model: string; modelAvailable: boolean;
  latencyMs: number | null; checkedAt: string; error?: { kind: AiErrorKind; message: string };
};

// Connectivity check via the model list: no tokens are spent.
export async function checkAiHealth(): Promise<AiHealth> {
  const base = { provider: "groq" as const, model: env.GROQ_MODEL, configured: Boolean(env.GROQ_API_KEY), checkedAt: new Date().toISOString() };
  const started = Date.now();
  try {
    const models = await listModels();
    const modelAvailable = models.includes(env.GROQ_MODEL);
    return {
      ...base, reachable: true, modelAvailable, latencyMs: Date.now() - started,
      ...(!modelAvailable && { error: { kind: "MODEL_NOT_FOUND" as const, message: `GROQ_MODEL "${env.GROQ_MODEL}" is not in this account's model list` } }),
    };
  } catch (err) {
    const e = err instanceof AiProviderError ? err : new AiProviderError("UNAVAILABLE", "AI health check failed");
    return { ...base, reachable: e.kind !== "NOT_CONFIGURED" && e.kind !== "UNAVAILABLE" && e.kind !== "TIMEOUT", modelAvailable: false, latencyMs: null, error: { kind: e.kind, message: e.message } };
  }
}
