// Verifies the Groq setup end to end: key loaded, model available, one tiny real chat request.
// Run with `npm run ai:check`. Never prints the key.
import { env } from "../config/env.js";
import { AiProviderError, chat, listModels } from "../ai/groq.js";
import { prisma } from "../db.js";

const line = (label: string, value: string) => console.log(`${label.padEnd(22)} ${value}`);

try {
  line("GROQ_API_KEY", env.GROQ_API_KEY ? `set (${env.GROQ_API_KEY.length} characters)` : "NOT SET");
  line("GROQ_MODEL", env.GROQ_MODEL);
  line("Timeout", `${env.GROQ_TIMEOUT_MS} ms`);

  const models = await listModels();
  const available = models.includes(env.GROQ_MODEL);
  line("Models on account", String(models.length));
  line("Configured model", available ? "available" : "NOT AVAILABLE");
  if (!available) {
    console.log("\nChat models on this account:\n  " + models.filter((m) => !/whisper|tts|guard/i.test(m)).join("\n  "));
    process.exitCode = 1;
  } else {
    const r = await chat(
      [
        { role: "system", content: "You are a connectivity check. Reply with exactly the word OK." },
        { role: "user", content: "Connectivity check" },
      ],
      { maxTokens: 64, temperature: 0, feature: "HEALTH_CHECK" }, // room for a reasoning model's short thinking step
    );
    line("Test request", "succeeded");
    line("Reply", JSON.stringify(r.content.trim()));
    line("Model used", r.model);
    line("Latency", `${r.latencyMs} ms`);
    line("Tokens", `${r.promptTokens ?? "?"} prompt + ${r.completionTokens ?? "?"} completion`);
  }
} catch (err) {
  if (err instanceof AiProviderError) {
    line("FAILED", `${err.kind}: ${err.message}`);
  } else {
    line("FAILED", err instanceof Error ? err.message : String(err));
  }
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
