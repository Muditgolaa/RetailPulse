import { useState } from "react";
import { Link } from "react-router";
import ProductVisual from "../storefront/ProductVisual.jsx";
import StockBadge from "../storefront/StockBadge.jsx";
import Button from "../ui/Button.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import { ErrorState } from "../ui/States.jsx";
import { formatPrice } from "../../lib/format.js";
import { useCart } from "../../store/cart.js";
import { toast } from "../../store/toast.js";

// Loading, error, clarification and result states for a recommendation request.
export default function RecommendationResults({ loading, error, result, onRetry, compact = false }) {
  const [showJson, setShowJson] = useState(false);

  if (loading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Finding products">
        <p className="text-sm text-ink-soft">Reading your request and checking the catalogue…</p>
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
    );
  }
  if (error) return <ErrorState title="The shopping assistant couldn't answer" error={error} onRetry={onRetry} />;
  if (!result) return null;

  return (
    <section className="flex flex-col gap-4" aria-live="polite">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-ink-soft">
          Looking for: <span className="text-ink">{result.interpretedRequirement}</span>
        </p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${result.source === "AI" ? "bg-forest-soft text-forest" : "bg-ivory-deep text-ink-soft"}`}>
          {result.source === "AI" ? "AI ranked" : "Ranked by filters"}
        </span>
      </div>

      {result.notice && <p className="rounded-md bg-amber-soft px-3 py-2 text-sm text-amber">{result.notice}</p>}

      {result.clarifyingQuestion && (
        <p className="rounded-lg border border-forest/25 bg-forest-soft/60 px-4 py-3">{result.clarifyingQuestion}</p>
      )}

      <ol className="flex flex-col gap-3">
        {result.recommendations.map((rec, i) => <RecommendationCard key={rec.productId} rec={rec} best={i === 0} compact={compact} />)}
      </ol>

      <button onClick={() => setShowJson((v) => !v)} className="self-start text-sm text-forest hover:underline">
        {showJson ? "Hide" : "View"} JSON response
      </button>
      {showJson && <pre className="max-h-96 overflow-auto rounded-lg bg-ink p-4 text-xs text-ivory">{JSON.stringify(result, null, 2)}</pre>}
    </section>
  );
}

const SPEC_KEYS = ["cpu", "chip", "ram", "gpu", "storage", "display", "screenInch", "capacityL", "capacityKg", "batteryMah", "type"];

function RecommendationCard({ rec, best, compact }) {
  const add = useCart((s) => s.add);
  const product = { ...rec, sku: rec.productId }; // cart and artwork key products by sku
  const specs = SPEC_KEYS.filter((k) => rec.specs?.[k] !== undefined).slice(0, compact ? 3 : 4).map((k) => String(rec.specs[k]));
  const out = rec.availability === "OUT_OF_STOCK";

  return (
    <li className="flex gap-4 rounded-lg border border-line bg-white/70 p-4">
      <Link to={`/products/${rec.productId}`} className="shrink-0 overflow-hidden rounded-md">
        <ProductVisual product={product} className={compact ? "size-20" : "size-24"} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            {best && <span className="mb-1 inline-block rounded bg-forest px-1.5 py-0.5 text-[0.7rem] font-medium text-ivory">Best match</span>}
            <Link to={`/products/${rec.productId}`} className="block font-display text-lg leading-snug hover:underline">{rec.name}</Link>
            <p className="text-xs text-ink-soft">{rec.brand} · ★ {rec.rating.toFixed(1)}</p>
          </div>
          <span className="tabular text-lg font-semibold">{formatPrice(rec.price)}</span>
        </div>

        {specs.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Key specifications">
            {specs.map((s) => <li key={s} className="rounded bg-ivory-deep px-2 py-0.5 text-xs">{s}</li>)}
          </ul>
        )}

        <p className="text-sm"><span className="text-ink-soft">Why: </span>{rec.reason}</p>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5 text-xs">
            <StockBadge availability={{ status: rec.availability, available: rec.availableQty }} className="self-start" />
            {rec.alternativeStore && (
              <span className="text-ink-soft">Available at {rec.alternativeStore.storeCode} ({rec.alternativeStore.available})</span>
            )}
          </div>
          {out ? (
            <Link to={`/products/${rec.productId}`} className="text-sm text-forest hover:underline">See other stores</Link>
          ) : (
            <Button variant="outline" size="sm" onClick={() => { add(product); toast.success("Added to cart", rec.name); }}>
              Add to cart
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
