// Deterministic replenishment maths. The AI may explain these numbers but never changes them.
//
// Business definitions (per store and product):
// - Available inventory: units that can be sold now = onHand − reserved (reserved = held for open orders).
// - Inventory position: available + incomingQty (units already ordered from the supplier).
// - Demand: average units sold per day over the last 14 days of sales.
// - Lead time: days from placing a supplier order until the stock arrives at the store.
// - Target coverage: lead time + a 7-day review period. An order must cover demand until the next order could arrive.
// - Safety stock: extra units kept to absorb demand spikes and supplier delays.
// - Reorder point: when the inventory position falls to this level, the item needs replenishment.
// - Days of cover: how many days available stock lasts at current demand (none when there is no demand).
// - Severity: CRITICAL when days of cover is shorter than the lead time (a stock-out before a new order
//   could arrive) or when the item is already out of stock while still selling; LOW when it is at or below
//   the reorder point otherwise; OK above the reorder point.
// - Reorder quantity: ceil(demand × target coverage) + safety stock − inventory position, at least 0,
//   capped at 3 × reorder point as a guardrail against bad data.

export const SALES_WINDOW_DAYS = 14;
export const REVIEW_PERIOD_DAYS = 7;
export const MAX_ORDER_MULTIPLE = 3;

export type StockInput = {
  onHand: number; reserved: number; incomingQty: number;
  reorderPoint: number; safetyStock: number; leadTimeDays: number;
  unitsSoldInWindow: number;
};

export type Severity = "OK" | "LOW" | "CRITICAL";

export type StockAssessment = {
  available: number;
  inventoryPosition: number;
  avgDailySales: number;
  daysOfCover: number | null;
  targetCoverageDays: number;
  needsReplenishment: boolean;
  severity: Severity;
  suggestedQty: number;
  capped: boolean;
};

export const FORMULA = "ceil(avgDailySales × (leadTimeDays + 7)) + safetyStock − (available + incoming), capped at 3 × reorderPoint";

export function assessStock(i: StockInput): StockAssessment {
  const available = i.onHand - i.reserved;
  const inventoryPosition = available + i.incomingQty;
  const avgDailySales = i.unitsSoldInWindow / SALES_WINDOW_DAYS;
  const daysOfCover = avgDailySales > 0 ? available / avgDailySales : null;
  const targetCoverageDays = i.leadTimeDays + REVIEW_PERIOD_DAYS;
  const needsReplenishment = inventoryPosition <= i.reorderPoint;

  const stockoutBeforeDelivery = daysOfCover !== null && daysOfCover < i.leadTimeDays;
  const severity: Severity = !needsReplenishment ? "OK" : stockoutBeforeDelivery ? "CRITICAL" : "LOW";

  const raw = needsReplenishment ? Math.ceil(avgDailySales * targetCoverageDays) + i.safetyStock - inventoryPosition : 0;
  const cap = i.reorderPoint * MAX_ORDER_MULTIPLE;
  const suggestedQty = Math.min(Math.max(raw, 0), cap);

  return {
    available, inventoryPosition, avgDailySales: round(avgDailySales, 2), daysOfCover: daysOfCover === null ? null : round(daysOfCover, 1),
    targetCoverageDays, needsReplenishment, severity, suggestedQty, capped: raw > cap,
  };
}

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;
