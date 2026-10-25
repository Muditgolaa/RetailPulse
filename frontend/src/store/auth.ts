import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../types";

type AuthState = {
  user: User | null;
  token: string | null;
  demo: boolean; // signed in through the temporary one-click demo access
  signIn: (user: User, token: string, demo?: boolean) => void;
  setUser: (user: User) => void;
  signOut: () => void;
};

// The server is the source of truth for who the user is and their role; this is only a cache for the UI.
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      demo: false,
      signIn: (user, token, demo = false) => set({ user, token, demo }),
      setUser: (user) => set({ user }),
      signOut: () => set({ user: null, token: null, demo: false }),
    }),
    {
      name: "rp-auth",
      version: 1,
      partialize: ({ user, token, demo }) => ({ user, token, demo }), // only the session is saved
      migrate: () => ({ user: null, token: null, demo: false }), // sessions from older versions start signed out
    },
  ),
);

// Managers and admins start on the operations dashboard; customers on the storefront.
export const homeFor = (user: User | null) => (user?.role === "MANAGER" || user?.role === "ADMIN" ? "/ops" : "/");
