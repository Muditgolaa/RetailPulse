import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const ISSUER = "retailpulse";

// The token only carries the user id; the role is always re-read from the database.
export function signToken(userId: number): string {
  return jwt.sign({}, env.JWT_SECRET, {
    subject: String(userId),
    issuer: ISSUER,
    algorithm: "HS256",
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

// Returns the user id, or null if the token is missing, forged, expired or malformed.
export function verifyToken(token: string): number | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { issuer: ISSUER, algorithms: ["HS256"] });
    const id = Number(typeof payload === "object" ? payload.sub : NaN);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}
