import { Link } from "react-router";
import { homeFor, useAuth } from "../store/auth.js";

export default function NotFound() {
  const user = useAuth((s) => s.user);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-display text-6xl">404</p>
      <p className="text-ink-soft">This page doesn't exist.</p>
      <Link to={user ? homeFor(user) : "/login"} className="text-forest hover:underline">Go back home</Link>
    </div>
  );
}
