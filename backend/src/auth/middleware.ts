import type { RequestHandler } from "express";
import { prisma } from "../db.js";
import type { Role } from "../generated/prisma/client.js";
import { HttpError } from "../lib/http.js";
import { verifyToken } from "./jwt.js";

export const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  membershipTier: true,
  country: true,
  preferredStoreId: true,
  preferences: true,
} as const;

// Verifies the Bearer token and loads the user from the database into req.user.
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return next(new HttpError(401, "Sign in required"));

  const userId = verifyToken(token);
  if (!userId) return next(new HttpError(401, "Invalid or expired token"));

  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  if (!user) return next(new HttpError(401, "Invalid or expired token"));

  req.user = user;
  next();
};

// Use after requireAuth. The role comes from the database, never from the request.
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, "Sign in required"));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, "You don't have access to this resource"));
    next();
  };
