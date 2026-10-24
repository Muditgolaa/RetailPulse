import { create } from "zustand";
import { persist } from "zustand/middleware";

export const MAX_QTY = 10;
const clamp = (qty) => Math.min(MAX_QTY, Math.max(1, qty));

// The cart lives in the browser until the cart API exists; it is never sent anywhere except at checkout.
export const useCart = create(
  persist(
    (set) => ({
      items: [], // { sku, name, brand, category, price, qty }
      add: (product, qty = 1) =>
        set((s) => {
          const existing = s.items.find((i) => i.sku === product.sku);
          if (existing) {
            return { items: s.items.map((i) => (i.sku === product.sku ? { ...i, qty: clamp(i.qty + qty) } : i)) };
          }
          const { sku, name, brand, category, price } = product;
          return { items: [...s.items, { sku, name, brand, category, price, qty: clamp(qty) }] };
        }),
      setQty: (sku, qty) => set((s) => ({ items: s.items.map((i) => (i.sku === sku ? { ...i, qty: clamp(qty) } : i)) })),
      remove: (sku) => set((s) => ({ items: s.items.filter((i) => i.sku !== sku) })),
      clear: () => set({ items: [] }),
    }),
    { name: "rp-cart" },
  ),
);

export const cartCount = (items) => items.reduce((n, i) => n + i.qty, 0);
export const cartSubtotal = (items) => items.reduce((sum, i) => sum + i.price * i.qty, 0);
