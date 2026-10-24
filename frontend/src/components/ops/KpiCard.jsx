import Skeleton from "../ui/Skeleton.jsx";

const tones = {
  neutral: "text-ops-text",
  good: "text-ops-emerald",
  warn: "text-ops-amber",
  bad: "text-ops-red",
};

export default function KpiCard({ label, value, title, hint, tone = "neutral", loading }) {
  return (
    <div className="min-w-0 rounded-lg border border-ops-line bg-ops-panel px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-ops-muted">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-20 text-ops-text" />
      ) : (
        <p className={`tabular mt-1 truncate font-mono text-xl font-medium sm:text-2xl ${tones[tone]}`} title={title}>{value}</p>
      )}
      {hint && <p className="mt-0.5 text-xs text-ops-muted">{hint}</p>}
    </div>
  );
}
