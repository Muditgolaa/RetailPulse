// Runs the golden questions (knowledge/eval/golden-questions.json) through retrieval and reports the hit rate.
// `npm run kb:eval` checks retrieval only (no tokens). `npm run kb:eval -- --answer` also asks Groq for answers.
import { readFile } from "node:fs/promises";
import { env } from "../config/env.js";
import { prisma } from "../db.js";
import { retrieve } from "../rag/retrieve.js";
import { ask } from "../rag/answer.js";

type Golden = { id: string; question: string; askAs: string; expectFound: boolean; expectedSources: { docId: string; section: string }[] };

const withAnswers = process.argv.includes("--answer");
const { questions } = JSON.parse(await readFile("knowledge/eval/golden-questions.json", "utf8")) as { questions: Golden[] };

let hits = 0;
console.log(`Threshold ${env.RAG_MIN_SIMILARITY} · top-k ${env.RAG_TOP_K}\n`);
try {
  for (const g of questions) {
    const viewer = { country: "IN", membershipTier: g.askAs };
    const { evidence, nearest } = await retrieve(g.question, viewer);
    const found = evidence.map((e) => `${e.documentId}#${e.section}`);
    const hit = g.expectFound ? g.expectedSources.some((s) => found.includes(`${s.docId}#${s.section}`)) : evidence.length === 0;
    if (hit) hits++;
    console.log(`${hit ? "HIT " : "MISS"} ${g.id} [${g.askAs}] ${g.question}`);
    for (const n of nearest) {
      const mark = n.similarity >= env.RAG_MIN_SIMILARITY ? "✓" : " ";
      console.log(`       ${mark} ${n.similarity.toFixed(3)}  ${n.documentId} › ${n.section}`);
    }
    if (withAnswers) {
      const r = await ask(g.question, viewer, {});
      console.log(`       → ${r.status} (${r.confidence}) ${r.answer.replace(/\s+/g, " ").slice(0, 220)}`);
    }
  }
  console.log(`\nRetrieval hit-rate: ${hits}/${questions.length}`);
  if (hits < questions.length) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
