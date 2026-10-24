const styles = {
  CRITICAL: "bg-ops-red/15 text-ops-red",
  LOW: "bg-ops-amber/15 text-ops-amber",
  OK: "bg-ops-emerald/10 text-ops-emerald",
};
const labels = { CRITICAL: "Critical", LOW: "Low stock", OK: "Healthy" };

export default function SeverityPill({ severity }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${styles[severity]}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {labels[severity]}
    </span>
  );
}
