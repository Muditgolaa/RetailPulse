import { useState } from "react";
import { Link } from "react-router";
import ProductVisual from "../components/storefront/ProductVisual.jsx";
import QtyStepper from "../components/storefront/QtyStepper.jsx";
import Button from "../components/ui/Button.jsx";
import { EmptyState } from "../components/ui/States.jsx";
import { useStoreName } from "../components/StoreSelect.jsx";
import { errorMessage } from "../api/client.js";
import { placeOrder } from "../api/shop.js";
import { formatPrice } from "../lib/format.js";
import { cartSubtotal, useCart } from "../store/cart.js";
import { useShop } from "../store/shop.js";
import { toast } from "../store/toast.js";

export default function Cart() {
  const { items, setQty, remove, clear } = useCart();
  const storeId = useShop((s) => s.storeId);
  const storeName = useStoreName(storeId);
  const [fulfilment, setFulfilment] = useState("DELIVERY");
  const [placing, setPlacing] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [placedOrder, setPlacedOrder] = useState(null);
  const subtotal = cartSubtotal(items);

  async function checkout() {
    setPlacing(true);
    setCheckoutError(null);
    try {
      // Payment is simulated by the server; the order only counts once the API confirms it.
      const order = await placeOrder({ storeId, fulfilment, items: items.map(({ sku, qty }) => ({ sku, qty })) });
      setPlacedOrder(order);
      clear();
      toast.success("Order placed", order?.code ? `Order ${order.code}` : undefined);
    } catch (err) {
      setCheckoutError(errorMessage(err));
      toast.error("Order not placed", errorMessage(err));
    } finally {
      setPlacing(false);
    }
  }

  if (placedOrder) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <p className="text-xs uppercase tracking-[0.18em] text-forest">Order confirmed by the server</p>
        <h1 className="mt-3 font-display text-4xl">Thank you</h1>
        <p className="mt-3 text-ink-soft">
          Order {placedOrder.code}
          {placedOrder.total !== undefined && ` · ${formatPrice(placedOrder.total)}`}
        </p>
        <Link to="/" className="mt-8 inline-block text-forest hover:underline">Continue shopping</Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <h1 className="font-display text-4xl">Your cart</h1>
        <EmptyState
          title="Your cart is empty"
          message="Browse the catalogue and add something you like."
          action={<Link to="/" className="inline-flex h-10 items-center rounded-md bg-forest px-4 text-sm font-medium text-ivory hover:bg-forest-deep">Start shopping</Link>}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-4xl">Your cart</h1>
      <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
        <ul className="self-start divide-y divide-line border-y border-line">
          {items.map((item) => (
            <li key={item.sku} className="flex gap-4 py-5">
              <Link to={`/products/${item.sku}`} className="shrink-0 overflow-hidden rounded-md">
                <ProductVisual product={item} className="size-24" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <Link to={`/products/${item.sku}`} className="font-display text-lg hover:underline">{item.name}</Link>
                  <p className="text-sm text-ink-soft">{item.brand} · {formatPrice(item.price)} each</p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <QtyStepper value={item.qty} onChange={(q) => setQty(item.sku, q)} label={`Quantity of ${item.name}`} />
                  <span className="tabular w-24 text-right font-semibold">{formatPrice(item.price * item.qty)}</span>
                  <button onClick={() => remove(item.sku)} className="text-sm text-ink-soft hover:text-danger" aria-label={`Remove ${item.name}`}>
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-lg border border-line bg-white/60 p-6">
          <h2 className="font-display text-xl">Checkout</h2>
          <fieldset className="mt-4 flex flex-col gap-2 text-sm">
            <legend className="mb-2 text-ink-soft">How would you like it?</legend>
            {[
              ["DELIVERY", "Home delivery"],
              ["PICKUP", `Pick up at ${storeName || "your store"}`],
            ].map(([value, label]) => (
              <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 ${fulfilment === value ? "border-forest bg-forest-soft/60" : "border-line"}`}>
                <input type="radio" name="fulfilment" value={value} checked={fulfilment === value} onChange={() => setFulfilment(value)} className="accent-forest" />
                {label}
              </label>
            ))}
          </fieldset>

          <dl className="mt-6 flex flex-col gap-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd className="tabular">{formatPrice(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Delivery</dt><dd>{fulfilment === "PICKUP" ? "Free" : "Calculated by the server"}</dd></div>
          </dl>

          {checkoutError && <p role="alert" className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">Order not placed. {checkoutError}</p>}

          <Button size="lg" className="mt-6 w-full" onClick={checkout} loading={placing}>
            Place order
          </Button>
          <p className="mt-3 text-xs text-ink-soft">Payment is simulated for this demo. Your cart stays here until the server confirms the order.</p>
        </aside>
      </div>
    </div>
  );
}
