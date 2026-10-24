import { Link } from "react-router";
import ProductVisual from "./ProductVisual.jsx";
import StockBadge from "./StockBadge.jsx";
import Button from "../ui/Button.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import { formatPrice } from "../../lib/format.js";
import { useCart } from "../../store/cart.js";
import { toast } from "../../store/toast.js";

export default function ProductCard({ product }) {
  const add = useCart((s) => s.add);
  const out = product.availability?.status === "OUT_OF_STOCK";

  return (
    <article className="group flex flex-col">
      <Link to={`/products/${product.sku}`} className="block overflow-hidden rounded-lg">
        <ProductVisual product={product} className="aspect-[4/3] transition-transform duration-300 group-hover:scale-[1.02]" />
      </Link>
      <div className="mt-4 flex flex-1 flex-col">
        <p className="text-xs uppercase tracking-[0.14em] text-ink-soft">{product.category}</p>
        <h3 className="mt-1 font-display text-lg leading-snug">
          <Link to={`/products/${product.sku}`} className="hover:underline">
            {product.name}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-ink-soft">★ {product.rating.toFixed(1)}</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="tabular text-lg font-semibold">{formatPrice(product.price)}</span>
          <StockBadge availability={product.availability} />
        </div>
        <div className="mt-4">
          {out ? (
            <Link to={`/products/${product.sku}`} className="inline-flex h-10 w-full items-center justify-center rounded-md border border-ink/20 text-sm font-medium hover:bg-ivory-deep">
              Check other stores
            </Link>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                add(product);
                toast.success("Added to cart", product.name);
              }}
            >
              Add to cart
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="text-ink">
      <Skeleton className="aspect-[4/3] w-full rounded-lg" />
      <Skeleton className="mt-4 h-3 w-1/3" />
      <Skeleton className="mt-2 h-5 w-3/4" />
      <Skeleton className="mt-3 h-5 w-1/2" />
      <Skeleton className="mt-4 h-10 w-full" />
    </div>
  );
}
