import { create } from "zustand";

export type Toast = { id: number; tone: "success" | "error" | "info"; title: string; message?: string };

type ToastState = {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
};

let nextId = 1;

export const useToast = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    setTimeout(() => get().dismiss(id), toast.tone === "error" ? 7000 : 4500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (title: string, message?: string) => useToast.getState().push({ tone: "success", title, message }),
  error: (title: string, message?: string) => useToast.getState().push({ tone: "error", title, message }),
  info: (title: string, message?: string) => useToast.getState().push({ tone: "info", title, message }),
};
