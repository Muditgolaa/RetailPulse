import { Navigate, Outlet } from "react-router";
import { homeFor, useAuth } from "../store/auth";
import type { Role } from "../types";

// Same rule as the server: admins can open manager pages too.
export const hasRole = (userRole: Role, role: Role) => userRole === role || (userRole === "ADMIN" && role === "MANAGER");

// UI guard only; the backend still checks the role on every request.
export default function RequireRole({ role }: { role: Role }) {
  const user = useAuth((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!hasRole(user.role, role)) return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}
