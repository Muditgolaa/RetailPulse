import { create } from "zustand";

let nextId = 1;

export const useToast = create((set, get) => ({
  toasts: [], // { id, tone: "success" | "error" | "info", title, message }
  push: (toast) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { tone: "info", ...toast, id }] }));
    setTimeout(() => get().dismiss(id), toast.tone === "error" ? 7000 : 4500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (title, message) => useToast.getState().push({ tone: "success", title, message }),
  error: (title, message) => useToast.getState().push({ tone: "error", title, message }),
  info: (title, message) => useToast.getState().push({ tone: "info", title, message }),
};
