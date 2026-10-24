import { create } from "zustand";
import { persist } from "zustand/middleware";

// Selected store (shared by storefront and operations). Store 1 is DEL01 in the seed data.
export const useShop = create(
  persist(
    (set) => ({
      storeId: 1,
      setStoreId: (storeId) => set({ storeId: Number(storeId) }),
    }),
    { name: "rp-shop" },
  ),
);
