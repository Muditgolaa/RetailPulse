import { useState } from "react";
import { Link } from "react-router";
import ProductVisual from "../components/storefront/ProductVisual";
import QtyStepper from "../components/storefront/QtyStepper";
import Button from "../components/ui/Button";
import { EmptyState } from "../components/ui/States";
import { useStoreName } from "../components/StoreSelect";
import { errorMessage } from "../api/client";
import { placeOrder } from "../api/shop";
import { formatPrice } from "../lib/format";
import { useAuth } from "../store/auth";
import { cartSubtotal, useCart } from "../store/cart";
import { useShop } from "../store/shop";
import { toast } from "../store/toast";
import type { Fulfilment, MembershipTier, Order } from "../types";

// Preview of the server's rule (backend/src/orders/service.ts). The server's figure is the one charged.
function estimateDeliveryFee(subtotal: number, fulfilment: Fulfilment, tier?: MembershipTier) {
  if (fulfilment === "PICKUP" || (tier && ["SILVER", "GOLD", "PLATINUM"].includes(tier)) || subtotal >= 999) return 0;
  return 49;
}

export default function Cart() {
  const { items, setQty, remove, clear } = useCart();
  const tier = useAuth((s) => s.user?.membershipTier);
  const storeId = useShop((s) => s.storeId);
  const storeName = useStoreName(storeId);
  const [fulfilment, setFulfilment] = useState<Fulfilment>("DELIVERY");
  const [placing, setPlacing] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  const subtotal = cartSubtotal(items);
  const fee = estimateDeliveryFee(subtotal, fulfilment, tier);

  async function checkout() {
    setPlacing(true);
    setCheckoutError(null);
    try {
      // Only SKUs and quantities are sent; the server prices the order and reserves the stock.
      const order = await placeOrder({ storeId, fulfilment, items: items.map(({ sku, qty }) => ({ sku, qty })) });
      setPlacedOrder(order);
      clear();
      toast.success("Order placed", `${order.code} · ${formatPrice(order.total)}`);
    } catch (err) {
      setCheckoutError(errorMessage(err));
      toast.error("Order not placed", errorMessage(err));
    } finally {
      setPlacing(false);
    }
  }

  if (placedOrder) return <OrderConfirmation order={placedOrder} />;

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
            {(
              [
                ["DELIVERY", "Home delivery (2–3 days in Delhi NCR)"],
                ["PICKUP", `Pick up at ${storeName || "your store"}`],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 ${fulfilment === value ? "border-forest bg-forest-soft/60" : "border-line"}`}>
                <input type="radio" name="fulfilment" value={value} checked={fulfilment === value} onChange={() => setFulfilment(value)} className="accent-forest" />
                {label}
              </label>
            ))}
          </fieldset>

          <dl className="mt-6 flex flex-col gap-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd className="tabular">{formatPrice(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Delivery</dt><dd className="tabular">{fee === 0 ? "Free" : formatPrice(fee)}</dd></div>
            <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>Total</dt><dd className="tabular">{formatPrice(subtotal + fee)}</dd></div>
          </dl>

          {checkoutError && <p role="alert" className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">Order not placed. {checkoutError}</p>}

          <Button size="lg" className="mt-6 w-full" onClick={checkout} loading={placing}>
            Place order
          </Button>
          <p className="mt-3 text-xs text-ink-soft">Payment is simulated. Prices and stock are checked again when you place the order.</p>
        </aside>
      </div>
    </div>
  );
}

function OrderConfirmation({ order }: { order: Order }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-3 text-center">
      <p className="text-xs uppercase tracking-[0.18em] text-forest">Order confirmed</p>
      <h1 className="font-display text-4xl">Thank you</h1>
      <p className="text-ink-soft">
        {order.code} · {formatPrice(order.total)} · {order.fulfilment === "PICKUP" ? `pick up at ${order.store.name}` : "home delivery"}
      </p>
      {order.statusNote && <p className="text-sm text-ink-soft">{order.statusNote}</p>}
      <div className="mt-6 flex gap-6">
        <Link to="/orders" className="text-forest hover:underline">View my orders</Link>
        <Link to="/" className="text-forest hover:underline">Continue shopping</Link>
      </div>
    </div>
  );
}
