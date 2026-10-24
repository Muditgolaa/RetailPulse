import { api } from "./client.js";

export const login = async (email, password) => (await api.post("/auth/login", { email, password })).data;

export const fetchMe = async () => (await api.get("/auth/me")).data.user;

export const savePreferences = async (prefs) => (await api.put("/me/preferences", prefs)).data.user;

// Temporary hackathon demo access: real token for a seeded demo account (server must enable it).
export const demoLogin = async (account) => (await api.post("/auth/demo", { account })).data;

export const placeOrder = async (order) => (await api.post("/orders", order)).data;

export const listOrders = async () => (await api.get("/orders")).data;

export const cancelOrder = async (code) => (await api.post(`/orders/${encodeURIComponent(code)}/cancel`)).data;

export const recommend = async (query, storeId) => (await api.post("/ai/recommend", { query, storeId })).data;

export const askPolicy = async (question) => (await api.post("/ai/ask", { question })).data;
