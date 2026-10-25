import { api } from "./client";
import type { AskResponse, NewOrder, Order, Preferences, RecommendResponse, User } from "../types";

type Session = { token: string; user: User };

export const login = async (email: string, password: string) => (await api.post<Session>("/auth/login", { email, password })).data;

export const register = async (name: string, email: string, password: string) =>
  (await api.post<Session>("/auth/register", { name, email, password })).data;

export const fetchMe = async () => (await api.get<{ user: User }>("/auth/me")).data.user;

export const savePreferences = async (prefs: Preferences & { preferredStoreId: number | null }) =>
  (await api.put<{ user: User }>("/me/preferences", prefs)).data.user;

// One-click demo access: a real token for a seeded demo account (an admin must switch it on).
export const demoLogin = async (account: "customer" | "manager") => (await api.post<Session>("/auth/demo", { account })).data;

export const placeOrder = async (order: NewOrder) => (await api.post<Order>("/orders", order)).data;

export const listOrders = async () => (await api.get<Order[]>("/orders")).data;

export const cancelOrder = async (code: string) => (await api.post<Order>(`/orders/${encodeURIComponent(code)}/cancel`)).data;

export const recommend = async (query: string, storeId: number) =>
  (await api.post<RecommendResponse>("/ai/recommend", { query, storeId })).data;

export const askPolicy = async (question: string) => (await api.post<AskResponse>("/ai/ask", { question })).data;
