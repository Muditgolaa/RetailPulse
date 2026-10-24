import { useState } from "react";
import SeverityPill from "./SeverityPill.jsx";
import { EmptyState } from "../ui/States.jsx";
import { formatNumber } from "../../lib/format.js";

const order = { CRITICAL: 0, LOW: 1, OK: 2 };

export default function StockTable({ items }) {
  const [view, setView] = useState("attention");
  const attention = items.filter((r) => r.severity !== "OK");
  const rows = (view === "attention" ? attention : items)
    .slice()
    .sort((a, b) => order[a.severity] - order[b.severity] || (a.daysLeft ?? 999) - (b.daysLeft ?? 999) || a.sku.localeCompare(b.sku));

  const tab = (key, label) => (
    <button
      onClick={() => setView(key)}
      aria-pressed={view === key}
      className={`rounded-md px-3 py-1.5 text-sm ${view === key ? "bg-ops-raised text-ops-text" : "text-ops-muted hover:text-ops-text"}`}
    >
      {label}
    </button>
  );

  return (
    <section className="rounded-lg border border-ops-line bg-ops-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ops-line px-4 py-3">
        <h2 className="font-medium">Inventory</h2>
        <div className="flex gap-1">
          {tab("attention", `Needs attention (${attention.length})`)}
          {tab("all", `All items (${items.length})`)}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-4">
          <EmptyState dark title="Nothing needs attention" message="Every item at this store is above its reorder point." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-ops-muted">
                <th className="px-4 py-2 font-medium">Item</th>
                <th className="px-3 py-2 text-right font-medium">Available</th>
                <th className="px-3 py-2 text-right font-medium">Reorder at</th>
                <th className="px-3 py-2 text-right font-medium">Avg / day</th>
                <th className="px-3 py-2 text-right font-medium">Days left</th>
                <th className="px-3 py-2 text-right font-medium">Lead time</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ops-line">
              {rows.map((r) => (
                <tr key={r.sku} className="hover:bg-ops-raised/60">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{r.name}</p>
                    <p className="font-mono text-xs text-ops-muted">{r.sku} · {r.category}</p>
                  </td>
                  <td className={`tabular px-3 py-2.5 text-right font-mono ${r.available === 0 ? "text-ops-red" : ""}`}>
                    {r.available}
                    {r.incomingQty > 0 && <span className="block text-xs text-ops-muted">+{r.incomingQty} incoming</span>}
                  </td>
                  <td className="tabular px-3 py-2.5 text-right font-mono text-ops-muted">{r.reorderPoint}</td>
                  <td className="tabular px-3 py-2.5 text-right font-mono">{formatNumber(r.avgDaily, 1)}</td>
                  <td className={`tabular px-3 py-2.5 text-right font-mono ${r.severity === "CRITICAL" ? "text-ops-red" : ""}`}>
                    {r.daysLeft === null ? "—" : formatNumber(r.daysLeft, 1)}
                  </td>
                  <td className="tabular px-3 py-2.5 text-right font-mono text-ops-muted">{r.leadTimeDays} d</td>
                  <td className="px-4 py-2.5"><SeverityPill severity={r.severity} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
