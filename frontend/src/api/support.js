import { api } from "./client.js";

export const sendSupportMessage = async (message, history) => (await api.post("/support/chat", { message, history })).data;

export const listTickets = async (status) => (await api.get("/support/tickets", { params: status ? { status } : {} })).data;

export const updateTicketStatus = async (id, status) => (await api.patch(`/support/tickets/${id}`, { status })).data;
