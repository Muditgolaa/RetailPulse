import { api } from "./client.js";

export const listDocuments = async () => (await api.get("/kb/documents")).data;

export const uploadDocument = async (doc) => (await api.post("/kb/documents", doc)).data;

export const deleteDocument = async (documentId) => (await api.delete(`/kb/documents/${encodeURIComponent(documentId)}`)).data;
