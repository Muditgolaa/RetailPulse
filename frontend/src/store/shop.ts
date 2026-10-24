import { create } from "zustand";
import { persist } from "zustand/middleware";

type ShopState = { storeId: number; setStoreId: (storeId: number | string) => void };

// Selected store (shared by storefront and operations). Store 1 is DEL01 in the seed data.
export const useShop = create<ShopState>()(
  persist(
    (set) => ({
      storeId: 1,
      setStoreId: (storeId) => set({ storeId: Number(storeId) }),
    }),
    { name: "rp-shop" },
  ),
);
