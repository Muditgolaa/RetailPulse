import { api } from "./client.js";

// Manager-only endpoints; the server checks the role on every call.
export const getStockOverview = async (storeId) => (await api.get("/ops/dashboard", { params: { storeId } })).data;

export const runScan = async (storeId) => (await api.post("/ops/scan", { storeId })).data;

export const getProposals = async (storeId) => (await api.get("/ops/actions", { params: { status: "PROPOSED", storeId } })).data;

export const getAudit = async (limit = 20) => (await api.get("/ops/audit", { params: { limit } })).data;

export const decideAction = async (id, decision, note) =>
  (await api.post(`/ops/actions/${encodeURIComponent(id)}/${decision}`, note ? { note } : {})).data;
