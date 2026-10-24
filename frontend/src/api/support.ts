import { api } from "./client";
import type { ChatTurn, SupportReply, Ticket, TicketStatus } from "../types";

export const sendSupportMessage = async (message: string, history: ChatTurn[]) =>
  (await api.post<SupportReply>("/support/chat", { message, history })).data;

export const listTickets = async (status?: TicketStatus) =>
  (await api.get<Ticket[]>("/support/tickets", { params: status ? { status } : {} })).data;

export const updateTicketStatus = async (id: number, status: TicketStatus) => (await api.patch<Ticket>(`/support/tickets/${id}`, { status })).data;
