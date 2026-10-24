import SeverityPill from "./SeverityPill.jsx";
import Button from "../ui/Button.jsx";
import { formatNumber } from "../../lib/format.js";

export default function ProposalCard({ proposal, busy, onDecide }) {
  const p = proposal.payload;
  const facts = [
    ["Available", p.available],
    ["Incoming", p.incomingQty],
    ["Avg / day", formatNumber(p.avgDailySales, 1)],
    ["Days of cover", p.daysOfCover ?? "—"],
    ["Lead time", `${p.leadTimeDays} d`],
    ["Target cover", `${p.targetCoverageDays} d`],
    ["Safety stock", p.safetyStock],
    ["Reorder point", p.reorderPoint],
  ];

  return (
    <article className="rounded-lg border border-ops-line bg-ops-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{proposal.product.name}</p>
          <p className="font-mono text-xs text-ops-muted">{proposal.product.sku} · {proposal.store.code} · proposal #{proposal.id}</p>
        </div>
        <SeverityPill severity={p.severity} />
      </div>

      <p className="mt-4 text-sm text-ops-muted">Suggested order</p>
      <p className="tabular font-mono text-3xl text-ops-lime">
        {p.suggestedQty} <span className="text-base text-ops-muted">units{p.capped ? " (capped)" : ""}</span>
      </p>

      <dl className="mt-3 grid grid-cols-4 gap-x-3 gap-y-2 text-xs">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="text-ops-muted">{k}</dt>
            <dd className="tabular font-mono text-sm text-ops-text">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 rounded bg-ops-raised px-2 py-1.5 font-mono text-xs text-ops-muted">{p.formula}</p>

      <div className="mt-3 text-sm">
        <p className="text-xs uppercase tracking-wider text-ops-muted">
          {p.explanationSource === "AI" ? "AI explanation" : "Explanation"} <span className="normal-case tracking-normal">· numbers from the formula</span>
        </p>
        <p className="mt-1 text-ops-text">{proposal.explanation}</p>
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="opsPrimary" size="sm" loading={busy === "approve"} disabled={Boolean(busy)} onClick={() => onDecide(proposal, "approve")}>
          Approve order
        </Button>
        <Button variant="opsDanger" size="sm" loading={busy === "reject"} disabled={Boolean(busy)} onClick={() => onDecide(proposal, "reject")}>
          Reject
        </Button>
      </div>
    </article>
  );
}
