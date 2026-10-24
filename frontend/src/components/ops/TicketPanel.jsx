import { useState } from "react";
import TicketStatus, { ticketCategoryLabel } from "../TicketStatus.jsx";
import Button from "../ui/Button.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import { EmptyState, ErrorState } from "../ui/States.jsx";
import { errorMessage } from "../../api/client.js";
import { listTickets, updateTicketStatus } from "../../api/support.js";
import { useAsync } from "../../lib/useAsync.js";
import { toast } from "../../store/toast.js";

const NEXT = { OPEN: ["IN_PROGRESS", "Start"], IN_PROGRESS: ["RESOLVED", "Resolve"] };
const PRIORITY = { HIGH: "text-ops-red", MEDIUM: "text-ops-amber", LOW: "text-ops-muted" };

// Customer support queue for managers: open and in-progress tickets, newest first.
export default function TicketPanel({ onChanged }) {
  const [filter, setFilter] = useState("ACTIVE");
  const tickets = useAsync(() => listTickets(), []);
  const [busy, setBusy] = useState(null);

  async function advance(ticket) {
    const [status] = NEXT[ticket.status];
    setBusy(ticket.id);
    try {
      await updateTicketStatus(ticket.id, status);
      toast.success(`Ticket #${ticket.id} ${status === "RESOLVED" ? "resolved" : "in progress"}`);
      tickets.reload();
      onChanged?.();
    } catch (err) {
      toast.error("Ticket not updated", errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const rows = (tickets.data ?? []).filter((t) => (filter === "ACTIVE" ? t.status !== "RESOLVED" : true));
  const tab = (key, label) => (
    <button onClick={() => setFilter(key)} aria-pressed={filter === key}
      className={`rounded-md px-3 py-1.5 text-sm ${filter === key ? "bg-ops-raised text-ops-text" : "text-ops-muted hover:text-ops-text"}`}>
      {label}
    </button>
  );

  return (
    <section className="rounded-lg border border-ops-line bg-ops-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ops-line px-4 py-3">
        <h2 className="font-medium">Support tickets</h2>
        <div className="flex gap-1">{tab("ACTIVE", "Open")}{tab("ALL", "All")}</div>
      </div>
      <div className="p-4">
        {tickets.error ? (
          <ErrorState dark title="Couldn't load tickets" error={tickets.error} onRetry={tickets.reload} />
        ) : tickets.loading ? (
          <Skeleton className="h-20 w-full text-ops-text" />
        ) : rows.length === 0 ? (
          <EmptyState dark title="No open tickets" message="Tickets opened by customers or the support assistant appear here." />
        ) : (
          <ul className="divide-y divide-ops-line text-sm">
            {rows.map((t) => (
              <li key={t.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    #{t.id} · {ticketCategoryLabel(t.category)}{t.order ? ` · ${t.order.code}` : ""}
                    <span className={`ml-2 font-mono text-xs ${PRIORITY[t.priority]}`}>{t.priority}</span>
                  </p>
                  <p className="mt-0.5 text-ops-muted">{t.summary}</p>
                  <p className="mt-1 font-mono text-xs text-ops-muted">
                    {t.user.name} ({t.user.membershipTier.toLowerCase()}) · {t.createdBy === "AGENT" ? "opened by assistant" : "opened by customer"} ·{" "}
                    {new Date(t.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <TicketStatus status={t.status} dark />
                  {NEXT[t.status] && (
                    <Button variant="opsOutline" size="sm" loading={busy === t.id} disabled={busy !== null} onClick={() => advance(t)}>
                      {NEXT[t.status][1]}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
