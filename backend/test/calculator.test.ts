import { describe, expect, it } from "vitest";
import { assessStock } from "../src/inventory/calculator.js";

const base = { onHand: 12, reserved: 0, incomingQty: 0, reorderPoint: 40, safetyStock: 15, leadTimeDays: 5, unitsSoldInWindow: 84 };

describe("assessStock", () => {
  it("matches the seeded boAt Rockerz example at DEL01: 75 units, CRITICAL", () => {
    // 84 sold / 14 days = 6/day; 12 / 6 = 2 days of cover < 5-day lead time; ceil(6 × 12) + 15 − 12 = 75
    expect(assessStock(base)).toMatchObject({
      available: 12, avgDailySales: 6, daysOfCover: 2, targetCoverageDays: 12, severity: "CRITICAL", suggestedQty: 75, capped: false,
    });
  });

  it("counts reserved units as unavailable and incoming units in the order quantity", () => {
    const r = assessStock({ ...base, onHand: 20, reserved: 8, incomingQty: 10 });
    expect(r.available).toBe(12);
    expect(r.inventoryPosition).toBe(22);
    expect(r.suggestedQty).toBe(72 + 15 - 22);
  });

  it("is LOW, not CRITICAL, when stock outlasts the lead time", () => {
    // Samsung fridge at DEL01: 3 sold in 14 days, 3 available, lead time 10 days
    const r = assessStock({ onHand: 3, reserved: 0, incomingQty: 0, reorderPoint: 6, safetyStock: 2, leadTimeDays: 10, unitsSoldInWindow: 3 });
    expect(r.severity).toBe("LOW");
    expect(r.daysOfCover).toBe(14);
    expect(r.suggestedQty).toBe(Math.ceil((3 / 14) * 17) + 2 - 3);
  });

  it("needs nothing above the reorder point, including stock already on order", () => {
    expect(assessStock({ ...base, onHand: 100 })).toMatchObject({ needsReplenishment: false, severity: "OK", suggestedQty: 0 });
    expect(assessStock({ ...base, incomingQty: 40 })).toMatchObject({ needsReplenishment: false, suggestedQty: 0 });
  });

  it("handles zero demand without dividing by zero", () => {
    const r = assessStock({ ...base, unitsSoldInWindow: 0 });
    expect(r.daysOfCover).toBeNull();
    expect(r.severity).toBe("LOW");
    expect(r.suggestedQty).toBe(15 - 12);
  });

  it("caps the quantity at 3 × reorder point", () => {
    const r = assessStock({ ...base, unitsSoldInWindow: 14_000 });
    expect(r.suggestedQty).toBe(120);
    expect(r.capped).toBe(true);
  });

  it("never suggests a negative quantity", () => {
    expect(assessStock({ ...base, onHand: 39, unitsSoldInWindow: 0, safetyStock: 0 }).suggestedQty).toBe(0);
  });
});
