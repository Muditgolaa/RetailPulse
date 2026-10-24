import type { MembershipTier, Role } from "../generated/prisma/client.js";

declare global {
  namespace Express {
    interface Request {
      // Set by requireAuth from the verified token + database lookup.
      user?: {
        id: number;
        email: string;
        name: string;
        role: Role;
        membershipTier: MembershipTier;
        country: string;
        preferredStoreId: number | null;
        preferences: unknown;
      };
    }
  }
}

export {};
