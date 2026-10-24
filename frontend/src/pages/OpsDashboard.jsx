import { useState } from "react";
import KpiCard from "../components/ops/KpiCard.jsx";
import AuditList from "../components/ops/AuditList.jsx";
import ProposalCard from "../components/ops/ProposalCard.jsx";
import StockTable from "../components/ops/StockTable.jsx";
import Button from "../components/ui/Button.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import { EmptyState, ErrorState } from "../components/ui/States.jsx";
import { useStoreName } from "../components/StoreSelect.jsx";
import { errorMessage } from "../api/client.js";
import { decideAction, getAudit, getProposals, getStockOverview, runScan } from "../api/ops.js";
import { formatPrice, formatPriceShort } from "../lib/format.js";
import { useAsync } from "../lib/useAsync.js";
import { useShop } from "../store/shop.js";
import { toast } from "../store/toast.js";

export default function OpsDashboard() {
  const storeId = useShop((s) => s.storeId);
  const storeName = useStoreName(storeId);
  const overview = useAsync(() => getStockOverview(storeId), [storeId]);
  const proposals = useAsync(() => getProposals(storeId), [storeId]);
  const audit = useAsync(() => getAudit(), []);
  const [busy, setBusy] = useState({}); // proposal id → "approve" | "reject"
  const [scanning, setScanning] = useState(false);
  const [latestAuditId, setLatestAuditId] = useState(null);

  const refresh = () => {
    proposals.reload();
    overview.reload();
    getAudit().then((rows) => setLatestAuditId(rows[0]?.id ?? null)).catch(() => {});
    audit.reload();
  };

  async function scan() {
    setScanning(true);
    try {
      const r = await runScan(storeId);
      const msg = `${r.created.length} new proposal${r.created.length === 1 ? "" : "s"}, ${r.skipped.length} already open`;
      toast.success(`Scanned ${r.scannedItems} items at ${r.storeCode}`, msg);
      refresh();
    } catch (err) {
      toast.error("Scan failed", errorMessage(err));
    } finally {
      setScanning(false);
    }
  }

  async function decide(proposal, decision) {
    setBusy((b) => ({ ...b, [proposal.id]: decision }));
    try {
      const updated = await decideAction(proposal.id, decision);
      const what = decision === "approve" ? `Order for ${updated.payload.suggestedQty} × ${proposal.product.name} placed` : proposal.product.name;
      toast.success(decision === "approve" ? "Replenishment approved" : "Proposal rejected", `${what}. Recorded in the audit history.`);
      refresh();
    } catch (err) {
      toast.error(decision === "approve" ? "Not approved" : "Not rejected", `${errorMessage(err)} No change was made.`);
      if (err.response?.status === 409) refresh(); // someone else already decided it
    } finally {
      setBusy((b) => ({ ...b, [proposal.id]: undefined }));
    }
  }

  const k = overview.data?.kpis;
  const h = overview.data?.health;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-ops-muted">Store operations</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{storeName || "Inventory"}</h1>
        </div>
        <Button variant="opsPrimary" size="sm" onClick={scan} loading={scanning}>
          Run stock scan
        </Button>
      </div>

      {overview.error ? (
        <ErrorState dark title="Couldn't load inventory" error={overview.error} onRetry={overview.reload} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Active SKUs" value={k?.activeSkus} loading={overview.loading} />
            <KpiCard label="Stock value (cost)" value={k && formatPriceShort(k.stockValue)} title={k && formatPrice(k.stockValue)} loading={overview.loading} />
            <KpiCard label="Needs attention" value={k?.needsAttention} tone={k?.needsAttention ? "warn" : "good"} loading={overview.loading} />
            <KpiCard label="Critical" value={k?.critical} hint="Runs out before a delivery could arrive" tone={k?.critical ? "bad" : "good"} loading={overview.loading} />
          </div>
          {k && (
            <p className="-mt-3 text-xs text-ops-muted">
              {k.pendingApprovals} proposal{k.pendingApprovals === 1 ? "" : "s"} awaiting approval · quantities come from a fixed formula; AI only explains them
            </p>
          )}
          {h && <HealthBar health={h} />}
        </>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="min-w-0">
          {overview.loading ? <Skeleton className="h-96 w-full text-ops-text" /> : overview.data && <StockTable items={overview.data.items} />}
        </div>

        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium">Replenishment proposals</h2>
            <span className="font-mono text-xs text-ops-muted">{proposals.data?.length ?? 0} open</span>
          </div>
          {proposals.error ? (
            <ErrorState dark title="Couldn't load proposals" error={proposals.error} onRetry={proposals.reload} />
          ) : proposals.loading ? (
            [0, 1].map((i) => <Skeleton key={i} className="h-64 w-full text-ops-text" />)
          ) : proposals.data.length === 0 ? (
            <EmptyState dark title="No open proposals" message="Run a stock scan to create proposals for items at or below their reorder point."
              action={<Button variant="opsOutline" size="sm" onClick={scan} loading={scanning}>Run stock scan</Button>} />
          ) : (
            proposals.data.map((p) => <ProposalCard key={p.id} proposal={p} busy={busy[p.id]} onDecide={decide} />)
          )}
        </section>
      </div>

      <section className="rounded-lg border border-ops-line bg-ops-panel">
        <h2 className="border-b border-ops-line px-4 py-3 font-medium">Audit history</h2>
        <div className="p-4">
          {audit.error ? (
            <ErrorState dark title="Couldn't load audit history" error={audit.error} onRetry={audit.reload} />
          ) : audit.loading ? (
            <Skeleton className="h-16 w-full text-ops-text" />
          ) : audit.data.length === 0 ? (
            <EmptyState dark title="No activity recorded yet" message="Scans, approvals and rejections appear here once the server records them." />
          ) : (
            <AuditList entries={audit.data} highlightId={latestAuditId} />
          )}
        </div>
      </section>
    </div>
  );
}

function HealthBar({ health }) {
  const total = health.inStock + health.low + health.out || 1;
  const parts = [
    ["In stock", health.inStock, "bg-ops-emerald"],
    ["Low", health.low, "bg-ops-amber"],
    ["Out", health.out, "bg-ops-red"],
  ];
  return (
    <div className="rounded-lg border border-ops-line bg-ops-panel px-4 py-3">
      <div className="flex h-2 overflow-hidden rounded-full bg-ops-raised" role="img" aria-label={parts.map(([l, n]) => `${l} ${n}`).join(", ")}>
        {parts.map(([label, n, color]) => n > 0 && <div key={label} className={color} style={{ width: `${(n / total) * 100}%` }} />)}
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-ops-muted">
        {parts.map(([label, n, color]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${color}`} aria-hidden />
            {label} <span className="tabular font-mono text-ops-text">{n}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
