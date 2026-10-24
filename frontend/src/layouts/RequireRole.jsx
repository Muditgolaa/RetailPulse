import { Navigate, Outlet } from "react-router";
import { homeFor, useAuth } from "../store/auth.js";

// UI guard only; the backend must still check the role on every request.
export default function RequireRole({ role }) {
  const user = useAuth((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}
