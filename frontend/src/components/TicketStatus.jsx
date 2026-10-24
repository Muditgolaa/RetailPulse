const LABELS = { OPEN: "Open", IN_PROGRESS: "In progress", RESOLVED: "Resolved" };

const LIGHT = { OPEN: "bg-amber-soft text-amber", IN_PROGRESS: "bg-forest-soft text-forest", RESOLVED: "bg-ivory-deep text-ink-soft" };
const DARK = { OPEN: "bg-ops-amber/15 text-ops-amber", IN_PROGRESS: "bg-ops-emerald/15 text-ops-emerald", RESOLVED: "bg-ops-raised text-ops-muted" };

export const ticketCategoryLabel = (c) => c.charAt(0) + c.slice(1).toLowerCase().replace("_", " & ");

export default function TicketStatus({ status, dark = false }) {
  const style = (dark ? DARK : LIGHT)[status];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>{LABELS[status] ?? status}</span>;
}
