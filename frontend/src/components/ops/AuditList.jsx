const LABELS = {
  REPLENISHMENT_APPROVED: { text: "Approved replenishment", style: "text-ops-emerald" },
  REPLENISHMENT_REJECTED: { text: "Rejected replenishment", style: "text-ops-red" },
  INVENTORY_SCAN: { text: "Ran stock scan", style: "text-ops-lime" },
  ORDER_PLACED: { text: "Order placed", style: "text-ops-text" },
  ORDER_CANCELLED: { text: "Order cancelled", style: "text-ops-amber" },
};

function describe(a) {
  const d = a.details ?? {};
  if (a.action === "INVENTORY_SCAN") {
    return `${a.entityId}: ${d.createdActionIds?.length ?? 0} new proposal(s), ${d.skipped?.length ?? 0} already open`;
  }
  if (a.action === "ORDER_PLACED") return `${a.entityId} at ${d.storeCode} · ₹${Number(d.total).toLocaleString("en-IN")}`;
  if (a.action === "ORDER_CANCELLED") return `${a.entityId} · was ${String(d.previousStatus).toLowerCase().replace(/_/g, " ")}`;
  const change = d.inventoryChange
    ? ` · ordered ${d.inventoryChange.orderedQty} units, incoming ${d.inventoryChange.incomingBefore} → ${d.inventoryChange.incomingAfter}`
    : "";
  return `Proposal #${a.entityId}${change}${d.note ? ` · “${d.note}”` : ""}`;
}

export default function AuditList({ entries, highlightId }) {
  return (
    <ul className="divide-y divide-ops-line text-sm">
      {entries.map((a) => {
        const label = LABELS[a.action] ?? { text: a.action, style: "text-ops-text" };
        return (
          <li key={a.id} className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 ${a.id === highlightId ? "bg-ops-emerald/5" : ""}`}>
            <span className="min-w-0">
              <span className={`font-medium ${label.style}`}>{label.text}</span>
              <span className="text-ops-muted"> · {describe(a)}</span>
            </span>
            <span className="tabular font-mono text-xs text-ops-muted">
              {a.actorEmail} · {new Date(a.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
