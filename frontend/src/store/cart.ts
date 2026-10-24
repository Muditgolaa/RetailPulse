import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProductSummary } from "../types";

export const MAX_QTY = 10;
const clamp = (qty: number) => Math.min(MAX_QTY, Math.max(1, qty));

export type CartItem = ProductSummary & { qty: number };

type CartState = {
  items: CartItem[];
  add: (product: ProductSummary, qty?: number) => void;
  setQty: (sku: string, qty: number) => void;
  remove: (sku: string) => void;
  clear: () => void;
};

// The cart lives in the browser; only SKUs and quantities are sent, at checkout.
export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
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

export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.qty, 0);
export const cartSubtotal = (items: CartItem[]) => items.reduce((sum, i) => sum + i.price * i.qty, 0);
