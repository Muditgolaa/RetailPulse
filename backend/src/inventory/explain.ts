// Plain-language explanations of the calculated numbers. Groq only writes text; the numbers come from the calculator.
// Any explanation that cites a number not in the calculation is replaced by a template.
import { z } from "zod";
import { AiProviderError, chatJson } from "../ai/groq.js";
import { REVIEW_PERIOD_DAYS, SALES_WINDOW_DAYS, type StockAssessment } from "./calculator.js";

type Item = StockAssessment & { sku: string; name: string; leadTimeDays: number; safetyStock: number; reorderPoint: number; incomingQty: number; unitsSoldInWindow: number };
export type Explanation = { text: string; source: "AI" | "TEMPLATE" };

const schema = z.object({ explanations: z.array(z.object({ sku: z.string(), text: z.string().max(400) })).max(50) });

export async function explain(items: Item[], userId?: number): Promise<Map<string, Explanation>> {
  const result = new Map<string, Explanation>(items.map((i) => [i.sku, { text: template(i), source: "TEMPLATE" }]));
  if (items.length === 0) return result;

  const facts = items.map((i) => ({
    sku: i.sku, name: i.name, available: i.available, incoming: i.incomingQty, avgDailySales: i.avgDailySales,
    daysOfCover: i.daysOfCover, leadTimeDays: i.leadTimeDays, targetCoverageDays: i.targetCoverageDays,
    safetyStock: i.safetyStock, reorderPoint: i.reorderPoint, severity: i.severity, suggestedQty: i.suggestedQty,
    // Comparisons are computed here so the model never has to compare numbers itself.
    stockRunsOutBeforeDeliveryCouldArrive: i.daysOfCover !== null && i.daysOfCover < i.leadTimeDays,
    coverIsShorterThanTarget: i.daysOfCover === null || i.daysOfCover < i.targetCoverageDays,
  }));
  try {
    const reply = await chatJson(
      [
        {
          role: "system",
          content: [
            "You explain inventory replenishment proposals to a store manager in one or two short sentences each.",
            "The numbers are already calculated; use them exactly and do not compute or suggest different quantities.",
            "Do not compare numbers yourself: use the true/false comparison fields given for each item.",
            `Demand is the average over the last ${SALES_WINDOW_DAYS} days; target coverage is lead time plus a ${REVIEW_PERIOD_DAYS}-day review period.`,
            'Reply with a JSON object only: {"explanations": [{"sku": string, "text": string}]}.',
          ].join(" "),
        },
        { role: "user", content: `ITEMS:\n${facts.map((f) => JSON.stringify(f)).join("\n")}` },
      ],
      schema,
      { feature: "INVENTORY_EXPLAIN", userId, maxTokens: 1500, temperature: 0.2, timeoutMs: 15000 },
    );
    for (const e of reply.explanations) {
      const item = items.find((i) => i.sku === e.sku);
      if (item && e.text.trim() && numbersAreFromCalculation(e.text, item)) result.set(item.sku, { text: e.text.trim(), source: "AI" });
    }
  } catch (err) {
    if (!(err instanceof AiProviderError)) throw err; // provider problems → templates
  }
  return result;
}

const numbersIn = (text: string) => (text.replace(/(\d),(?=\d)/g, "$1").match(/\d+(?:\.\d+)?/g) ?? []).map(Number);

export function numbersAreFromCalculation(text: string, i: Item): boolean {
  const allowed = new Set(
    [i.available, i.incomingQty, i.avgDailySales, i.daysOfCover ?? -1, i.leadTimeDays, i.targetCoverageDays, i.safetyStock,
      i.reorderPoint, i.suggestedQty, i.inventoryPosition, i.unitsSoldInWindow, SALES_WINDOW_DAYS, REVIEW_PERIOD_DAYS, ...numbersIn(i.name)]
      .flatMap((n) => [n, Math.round(n), Math.round(n * 10) / 10]),
  );
  return numbersIn(text).every((n) => allowed.has(n));
}

function template(i: Item): string {
  const cover = i.daysOfCover === null ? "no recent sales" : `about ${i.daysOfCover} days of stock at ${i.avgDailySales} units a day`;
  const risk = i.severity === "CRITICAL" ? `, which is less than the ${i.leadTimeDays}-day supplier lead time` : "";
  return `${i.available} available with ${cover}${risk}. Ordering ${i.suggestedQty} covers ${i.targetCoverageDays} days of demand plus ${i.safetyStock} units of safety stock.`;
}
