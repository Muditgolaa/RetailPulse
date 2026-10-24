import { useState } from "react";
import { Link, useParams } from "react-router";
import ProductVisual from "../components/storefront/ProductVisual";
import StockBadge, { stockLabel } from "../components/storefront/StockBadge";
import QtyStepper from "../components/storefront/QtyStepper";
import Button from "../components/ui/Button";
import Skeleton from "../components/ui/Skeleton";
import { ErrorState } from "../components/ui/States";
import { getProduct } from "../api/catalog";
import { formatPrice } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { useCart } from "../store/cart";
import { useShop } from "../store/shop";
import { toast } from "../store/toast";
import { httpStatus } from "../api/client";

const SPEC_LABELS: Record<string, string> = {
  cpu: "Processor", gpu: "Graphics", ram: "Memory", capacityL: "Capacity (L)", capacityKg: "Capacity (kg)", weightKg: "Weight (kg)",
};

// Readable labels for spec keys: "cpu" → "Processor", "batteryMah" → "Battery Mah"
const specLabel = (key: string) => SPEC_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
const specValue = (v: string | number | boolean) => (v === true ? "Yes" : v === false ? "No" : String(v));

export default function ProductDetail() {
  const { sku = "" } = useParams();
  const storeId = useShop((s) => s.storeId);
  const add = useCart((s) => s.add);
  const [qty, setQty] = useState(1);
  const { data: product, loading, error, reload } = useAsync(() => getProduct(sku), [sku]);

  if (loading) return <DetailSkeleton />;
  if (error) {
    const notFound = httpStatus(error) === 404;
    return (
      <div className="flex flex-col gap-4">
        <ErrorState title={notFound ? "Product not found" : "Couldn't load this product"} error={error} onRetry={notFound ? undefined : reload} />
        <Link to="/" className="text-sm text-forest hover:underline">← Back to all products</Link>
      </div>
    );
  }

  const here = product.availability.find((a) => a.storeId === storeId);
  const elsewhere = product.availability.filter((a) => a.storeId !== storeId && a.available > 0);
  const canBuy = here && here.available > 0;

  return (
    <div className="flex flex-col gap-12">
      <nav className="text-sm text-ink-soft" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-ink">Shop</Link>
        <span className="mx-2">/</span>
        <Link to={`/?category=${encodeURIComponent(product.category)}`} className="hover:text-ink">{product.category}</Link>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <ProductVisual product={product} className="aspect-square rounded-xl lg:aspect-[5/4]" />

        <div className="flex flex-col gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-forest">{product.brand}</p>
            <h1 className="mt-2 font-display text-4xl leading-tight tracking-tight text-balance">{product.name}</h1>
            <p className="mt-2 text-sm text-ink-soft">★ {product.rating.toFixed(1)} · SKU {product.sku}</p>
          </div>

          <p className="tabular text-3xl font-semibold">{formatPrice(product.price)}</p>

          <div className="rounded-lg border border-line bg-white/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm">At <strong>{here?.storeName ?? "your store"}</strong></span>
              <StockBadge availability={here} />
            </div>
            {!canBuy && here && here.incomingQty > 0 && (
              <p className="mt-2 text-sm text-ink-soft">{here.incomingQty} units are on the way to this store.</p>
            )}
            {!canBuy && elsewhere.length > 0 && (
              <p className="mt-2 text-sm">
                Available at {elsewhere.map((a) => `${a.storeCode} (${a.available})`).join(", ")}. Change the store at the top of the page to buy it there.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <QtyStepper value={qty} onChange={setQty} />
            <Button
              size="lg"
              disabled={!canBuy}
              onClick={() => {
                add(product, qty);
                toast.success("Added to cart", `${qty} × ${product.name}`);
              }}
            >
              {canBuy ? "Add to cart" : "Not available at this store"}
            </Button>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link to={`/assistant?q=${encodeURIComponent(`Alternatives to ${product.name}`)}`} className="text-forest hover:underline">
              Ask the shopping assistant
            </Link>
            <Link to={`/policy?q=${encodeURIComponent(`What is the warranty and return policy for ${product.category.toLowerCase()}?`)}`} className="text-forest hover:underline">
              Warranty and returns
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <section>
          <h2 className="font-display text-2xl">Specifications</h2>
          <dl className="mt-4 divide-y divide-line border-y border-line">
            {Object.entries(product.specs).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[10rem_1fr] gap-4 py-3 text-sm">
                <dt className="text-ink-soft">{specLabel(k)}</dt>
                <dd>{specValue(v)}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h2 className="font-display text-2xl">Availability by store</h2>
          <table className="mt-4 w-full text-sm">
            <tbody className="divide-y divide-line border-y border-line">
              {product.availability.map((a) => (
                <tr key={a.storeId} className={a.storeId === storeId ? "bg-forest-soft/50" : ""}>
                  <td className="py-3 pr-4">
                    <span className="font-medium">{a.storeCode}</span> <span className="text-ink-soft">{a.storeName}, {a.city}</span>
                  </td>
                  <td className="tabular py-3 text-right">{stockLabel(a)}{a.status === "IN_STOCK" ? ` (${a.available})` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-16" aria-busy="true">
      <Skeleton className="aspect-square w-full rounded-xl lg:aspect-[5/4]" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-12 w-56" />
      </div>
    </div>
  );
}
