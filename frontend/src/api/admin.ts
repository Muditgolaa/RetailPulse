import { api } from "./client";
import type { AdminUser, MembershipTier, Role, SiteSettings } from "../types";

// Public: the login page reads these before anyone signs in.
export const getSiteSettings = async () => (await api.get<SiteSettings>("/settings")).data;

// Admin only.
export const updateSiteSettings = async (changes: Partial<SiteSettings>) => (await api.put<SiteSettings>("/admin/settings", changes)).data;

export const listUsers = async (q?: string) => (await api.get<AdminUser[]>("/admin/users", { params: q ? { q } : {} })).data;

export const updateUser = async (id: number, changes: { role?: Role; membershipTier?: MembershipTier }) =>
  (await api.patch<AdminUser>(`/admin/users/${id}`, changes)).data;
