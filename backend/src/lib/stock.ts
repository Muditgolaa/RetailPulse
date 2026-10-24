// Stock rules shared by the catalogue and operations endpoints.
export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

type InventoryRow = { onHand: number; reserved: number; incomingQty: number; reorderPoint: number };

export function availability(row: InventoryRow | undefined) {
  if (!row) return { status: "OUT_OF_STOCK" as StockStatus, available: 0, incomingQty: 0 };
  const available = row.onHand - row.reserved;
  const status: StockStatus = available <= 0 ? "OUT_OF_STOCK" : available <= row.reorderPoint ? "LOW_STOCK" : "IN_STOCK";
  return { status, available, incomingQty: row.incomingQty };
}
