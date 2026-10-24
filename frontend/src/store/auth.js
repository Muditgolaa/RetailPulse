import { create } from "zustand";
import { persist } from "zustand/middleware";

// The server is the source of truth for who the user is and their role; this is only a cache for the UI.
// `demo` marks a session started from the temporary one-click demo access.
export const useAuth = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      demo: false,
      signIn: (user, token, demo = false) => set({ user, token, demo }),
      setUser: (user) => set({ user }),
      signOut: () => set({ user: null, token: null, demo: false }),
    }),
    { name: "rp-auth", version: 1, migrate: () => ({ user: null, token: null, demo: false }) },
  ),
);

export const homeFor = (user) => (user?.role === "MANAGER" ? "/ops" : "/");
