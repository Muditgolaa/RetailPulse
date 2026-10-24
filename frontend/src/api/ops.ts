import { api } from "./client";
import type { AuditEntry, Proposal, ScanResult, StockOverview } from "../types";

// Manager-only endpoints; the server checks the role on every call.
export const getStockOverview = async (storeId: number) => (await api.get<StockOverview>("/ops/dashboard", { params: { storeId } })).data;

export const runScan = async (storeId: number) => (await api.post<ScanResult>("/ops/scan", { storeId })).data;

export const getProposals = async (storeId: number) =>
  (await api.get<Proposal[]>("/ops/actions", { params: { status: "PROPOSED", storeId } })).data;

export const getAudit = async (limit = 20) => (await api.get<AuditEntry[]>("/ops/audit", { params: { limit } })).data;

export const decideAction = async (id: number, decision: "approve" | "reject", note?: string) =>
  (await api.post<Proposal>(`/ops/actions/${id}/${decision}`, note ? { note } : {})).data;
