import { api } from "./client";
import type { KbDocument, KbUpload, KbUploadResult } from "../types";

export const listDocuments = async () => (await api.get<KbDocument[]>("/kb/documents")).data;

export const uploadDocument = async (doc: KbUpload) => (await api.post<KbUploadResult>("/kb/documents", doc)).data;

export const deleteDocument = async (documentId: string) =>
  (await api.delete<{ documentId: string; deletedChunks: number }>(`/kb/documents/${encodeURIComponent(documentId)}`)).data;
