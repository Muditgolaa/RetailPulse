import type { TicketCategory, TicketStatus as Status } from "../types";

const LABELS: Record<Status, string> = { OPEN: "Open", IN_PROGRESS: "In progress", RESOLVED: "Resolved" };

const LIGHT: Record<Status, string> = { OPEN: "bg-amber-soft text-amber", IN_PROGRESS: "bg-forest-soft text-forest", RESOLVED: "bg-ivory-deep text-ink-soft" };
const DARK: Record<Status, string> = { OPEN: "bg-ops-amber/15 text-ops-amber", IN_PROGRESS: "bg-ops-emerald/15 text-ops-emerald", RESOLVED: "bg-ops-raised text-ops-muted" };

// "RETURN_REFUND" → "Return & refund"
export const ticketCategoryLabel = (c: TicketCategory) => c.charAt(0) + c.slice(1).toLowerCase().replace("_", " & ");

export default function TicketStatus({ status, dark = false }: { status: Status; dark?: boolean }) {
  const style = (dark ? DARK : LIGHT)[status];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>{LABELS[status]}</span>;
}
