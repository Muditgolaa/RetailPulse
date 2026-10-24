import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { deleteDocument, listDocuments, uploadDocument, uploadInput } from "../rag/documents.js";

// Knowledge-base management: managers only.
export const kbRouter = Router();
kbRouter.use(requireAuth, requireRole("MANAGER"));

const manager = (req: Express.Request) => ({ id: req.user!.id, email: req.user!.email });

kbRouter.get("/documents", async (_req, res) => {
  res.json(await listDocuments());
});

kbRouter.post("/documents", async (req, res) => {
  const result = await uploadDocument(uploadInput.parse(req.body), manager(req));
  res.status(result.unchanged ? 200 : 201).json(result);
});

kbRouter.delete("/documents/:documentId", async (req, res) => {
  const documentId = z.string().regex(/^[a-z0-9-]{3,80}$/, "Invalid document id").parse(req.params.documentId);
  res.json(await deleteDocument(documentId, manager(req)));
});
