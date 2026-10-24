import { Link, NavLink, Outlet, useNavigate } from "react-router";
import MockBanner from "../components/ui/MockBanner";
import StoreSelect from "../components/StoreSelect";
import { useAuth } from "../store/auth";

const OPS_NAV = [
  { to: "/ops", text: "Dashboard", end: true },
  { to: "/ops/knowledge", text: "Knowledge base", end: false },
];

export default function OpsLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="ops min-h-screen bg-ops-bg text-ops-text">
      <MockBanner dark />
      <header className="border-b border-ops-line bg-ops-panel">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Link to="/ops" className="font-display text-xl tracking-tight">
            RetailPulse<span className="ml-2 rounded bg-ops-emerald/15 px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-widest text-ops-emerald">Ops</span>
          </Link>
          <nav className="flex gap-4 text-sm">
            {OPS_NAV.map(({ to, text, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? "text-ops-text" : "text-ops-muted hover:text-ops-text")}>
                {text}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-4">
            <StoreSelect dark id="ops-store" />
            <span className="hidden text-sm text-ops-muted sm:inline">{user?.name}</span>
            <button
              onClick={() => {
                signOut();
                navigate("/login");
              }}
              className="text-sm text-ops-muted hover:text-ops-text"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
