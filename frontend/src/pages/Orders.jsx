import { useState } from "react";
import { Link } from "react-router";
import Button from "../components/ui/Button.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import { EmptyState, ErrorState } from "../components/ui/States.jsx";
import { errorMessage } from "../api/client.js";
import { cancelOrder, listOrders } from "../api/shop.js";
import { formatPrice } from "../lib/format.js";
import { useAsync } from "../lib/useAsync.js";
import { toast } from "../store/toast.js";

const STATUS = {
  PLACED: { label: "Placed", style: "bg-forest-soft text-forest" },
  READY_FOR_PICKUP: { label: "Ready for pickup", style: "bg-forest-soft text-forest" },
  SHIPPED: { label: "Shipped", style: "bg-forest-soft text-forest" },
  DELAYED: { label: "Delayed", style: "bg-amber-soft text-amber" },
  DELIVERED: { label: "Delivered", style: "bg-ivory-deep text-ink-soft" },
  CANCELLED: { label: "Cancelled", style: "bg-danger-soft text-danger" },
};
// Matches the cancellation policy enforced by the server.
const CANCELLABLE = ["PLACED", "READY_FOR_PICKUP", "DELAYED"];

const formatDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function Orders() {
  const { data, loading, error, reload } = useAsync(() => listOrders(), []);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <h1 className="font-display text-4xl">My orders</h1>
      {error ? (
        <ErrorState title="Couldn't load your orders" error={error} onRetry={reload} />
      ) : loading ? (
        [0, 1].map((i) => <Skeleton key={i} className="h-36 w-full" />)
      ) : data.length === 0 ? (
        <EmptyState
          title="No orders yet"
          message="Orders you place appear here with their status."
          action={<Link to="/" className="text-forest hover:underline">Start shopping</Link>}
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {data.map((order) => <OrderCard key={order.code} order={order} onChanged={reload} />)}
        </ul>
      )}
    </div>
  );
}

function OrderCard({ order, onChanged }) {
  const [cancelling, setCancelling] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const status = STATUS[order.status] ?? { label: order.status, style: "bg-ivory-deep text-ink-soft" };
  const overdue = order.status === "DELAYED" && order.expectedDeliveryAt && new Date(order.expectedDeliveryAt) < new Date();

  async function cancel() {
    setCancelling(true);
    try {
      await cancelOrder(order.code);
      toast.success("Order cancelled", `${order.code} will be refunded to the original payment method.`);
      onChanged();
    } catch (err) {
      toast.error("Not cancelled", errorMessage(err));
    } finally {
      setCancelling(false);
      setConfirming(false);
    }
  }

  return (
    <li className="rounded-lg border border-line bg-white/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg">{order.code}</p>
          <p className="text-sm text-ink-soft">
            {formatDate(order.createdAt)} · {order.fulfilment === "PICKUP" ? `Pickup at ${order.store.name}` : "Home delivery"}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.style}`}>{status.label}</span>
      </div>

      <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
        {order.items.map((i) => (
          <li key={i.sku} className="flex justify-between gap-4 py-2">
            <Link to={`/products/${i.sku}`} className="hover:underline">{i.qty} × {i.name}</Link>
            <span className="tabular">{formatPrice(i.unitPrice * i.qty)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3 text-sm">
        <div className="text-ink-soft">
          {order.statusNote && <p>{order.statusNote}</p>}
          {order.expectedDeliveryAt && order.status !== "DELIVERED" && order.status !== "CANCELLED" && (
            <p>{overdue ? "Was expected" : "Expected"} by {formatDate(order.expectedDeliveryAt)}</p>
          )}
          {order.deliveredAt && <p>Delivered {formatDate(order.deliveredAt)}</p>}
        </div>
        <p className="tabular font-semibold">
          {order.deliveryFee > 0 && <span className="mr-2 font-normal text-ink-soft">incl. {formatPrice(order.deliveryFee)} delivery</span>}
          {formatPrice(order.total)}
        </p>
      </div>

      {CANCELLABLE.includes(order.status) && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {confirming ? (
            <>
              <span className="text-sm">Cancel {order.code} and get a refund?</span>
              <Button variant="primary" size="sm" onClick={cancel} loading={cancelling}>Yes, cancel order</Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={cancelling}>Keep order</Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>Cancel order</Button>
          )}
        </div>
      )}
    </li>
  );
}
