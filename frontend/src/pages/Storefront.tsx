import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import ProductCard, { ProductCardSkeleton } from "../components/storefront/ProductCard";
import RecommendDrawer from "../components/assistant/RecommendDrawer";
import Pagination from "../components/storefront/Pagination";
import Button from "../components/ui/Button";
import { EmptyState, ErrorState } from "../components/ui/States";
import { useStoreName } from "../components/StoreSelect";
import { getFacets, listProducts } from "../api/catalog";
import { useAsync } from "../lib/useAsync";
import { useShop } from "../store/shop";
import type { Facets } from "../types";

const SORTS = [
  ["rating,desc", "Top rated"],
  ["price,asc", "Price: low to high"],
  ["price,desc", "Price: high to low"],
  ["name,asc", "Name A–Z"],
];

export default function Storefront() {
  const [params, setParams] = useSearchParams();
  const storeId = useShop((s) => s.storeId);
  const storeName = useStoreName(storeId);
  const [facets, setFacets] = useState<Facets | null>(null);

  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const brand = params.get("brand") ?? "";
  const sort = params.get("sort") ?? "rating,desc";
  const inStock = params.get("inStock") === "1";
  const page = Number(params.get("page") ?? 0);
  const [search, setSearch] = useState(q);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const closeAssistant = useCallback(() => setAssistantOpen(false), []);

  useEffect(() => setSearch(q), [q]);
  useEffect(() => {
    getFacets().then(setFacets).catch(() => setFacets(null));
  }, []);

  const { data, loading, error, reload } = useAsync(
    () => listProducts({ q, category, brand, sort, inStock: inStock || undefined, storeId, page, size: 12 }),
    [q, category, brand, sort, inStock, storeId, page],
  );

  // Updates URL params; any filter change returns to the first page.
  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v === "" ? next.delete(k) : next.set(k, v)));
    if (!("page" in changes)) next.delete("page");
    setParams(next);
  };
  const hasFilters = q || category || brand || inStock;

  return (
    <div className="flex flex-col gap-10">
      <section className="grid gap-8 border-b border-line pb-10 lg:grid-cols-[1.2fr_1fr] lg:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-forest">{storeName || "NovaMart"}</p>
          <h1 className="mt-3 max-w-xl font-display text-4xl leading-[1.08] tracking-tight text-balance sm:text-5xl">
            Find the right thing, in stock near you.
          </h1>
        </div>
        <div className="flex flex-col gap-3">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              update({ q: search.trim() });
            }}
            className="flex gap-2"
          >
            <label htmlFor="catalogue-search" className="sr-only">Search products</label>
            <input
              id="catalogue-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search laptops, phones, brands…"
              className="h-12 min-w-0 flex-1 rounded-md border border-line bg-white px-4 text-base placeholder:text-ink-soft/70"
            />
            <Button type="submit" size="lg">Search</Button>
          </form>
          <button
            onClick={() => setAssistantOpen(true)}
            className="flex items-center justify-between gap-3 rounded-md border border-forest/30 bg-forest-soft/50 px-4 py-2.5 text-left text-sm hover:border-forest"
          >
            <span>
              <span className="font-medium text-forest">Not sure what to pick?</span>{" "}
              <span className="text-ink-soft">Describe your needs and budget to the shopping assistant.</span>
            </span>
            <span aria-hidden className="text-forest">→</span>
          </button>
        </div>
      </section>
      <RecommendDrawer open={assistantOpen} onClose={closeAssistant} />

      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Categories">
        {["", ...(facets?.categories ?? [])].map((c) => (
          <button
            key={c || "all"}
            onClick={() => update({ category: c })}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors ${
              category === c ? "border-ink bg-ink text-ivory" : "border-line hover:border-ink/40"
            }`}
          >
            {c || "All products"}
          </button>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <p className="tabular text-ink-soft" aria-live="polite">
          {loading ? "Loading products…" : data ? `${data.totalElements} product${data.totalElements === 1 ? "" : "s"}` : ""}
          {q && !loading ? ` for “${q}”` : ""}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-4">
          <label htmlFor="in-stock-filter" className="flex items-center gap-2">
            <input id="in-stock-filter" type="checkbox" checked={inStock} onChange={(e) => update({ inStock: e.target.checked ? "1" : "" })} className="size-4 accent-forest" />
            In stock at this store
          </label>
          <label htmlFor="brand-filter" className="sr-only">Brand</label>
          <select id="brand-filter" value={brand} onChange={(e) => update({ brand: e.target.value })} className="h-9 rounded-md border border-line bg-white px-2">
            <option value="">All brands</option>
            {facets?.brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <label htmlFor="sort" className="sr-only">Sort by</label>
          <select id="sort" value={sort} onChange={(e) => update({ sort: e.target.value })} className="h-9 rounded-md border border-line bg-white px-2">
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {hasFilters && (
            <button onClick={() => setParams({})} className="text-forest underline-offset-4 hover:underline">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {error ? (
        <ErrorState title="Couldn't load products" error={error} onRetry={reload} />
      ) : loading ? (
        <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      ) : data.content.length === 0 ? (
        <EmptyState
          title="No products match"
          message="Try a different search, another category, or turn off “In stock at this store”."
          action={<Button variant="outline" onClick={() => setParams({})}>Clear filters</Button>}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.content.map((p) => <ProductCard key={p.sku} product={p} />)}
          </div>
          <Pagination page={data.number} totalPages={data.totalPages} onChange={(p) => update({ page: String(p) })} />
        </>
      )}
    </div>
  );
}
