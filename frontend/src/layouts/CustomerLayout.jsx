import { Link, NavLink, Outlet, useNavigate } from "react-router";
import MockBanner from "../components/ui/MockBanner.jsx";
import StoreSelect from "../components/StoreSelect.jsx";
import { cartCount, useCart } from "../store/cart.js";
import { useAuth } from "../store/auth.js";

const nav = [
  { to: "/", label: "Shop", end: true },
  { to: "/assistant", label: "Shopping assistant" },
  { to: "/policy", label: "Policy help" },
];

export default function CustomerLayout() {
  const items = useCart((s) => s.items);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const count = cartCount(items);

  return (
    <div className="min-h-screen bg-ivory">
      <MockBanner />
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-3 px-4 py-4 sm:px-6">
          <Link to="/" className="font-display text-2xl tracking-tight">
            RetailPulse<span className="ml-1 align-super font-sans text-[0.6rem] font-semibold tracking-widest text-forest">AI</span>
          </Link>

          <nav className="order-3 flex w-full gap-6 text-sm sm:order-none sm:w-auto">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) => `border-b-2 pb-1 ${isActive ? "border-forest text-ink" : "border-transparent text-ink-soft hover:text-ink"}`}
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-4">
            <div className="hidden md:block">
              <StoreSelect id="header-store" />
            </div>
            <Link to="/cart" className="relative rounded-md px-2 py-1 text-sm hover:bg-ivory-deep" aria-label={`Cart, ${count} items`}>
              Cart
              <span className="tabular ml-1.5 inline-flex min-w-5 justify-center rounded-full bg-ink px-1.5 text-xs leading-5 text-ivory">{count}</span>
            </Link>
            <button
              onClick={() => {
                signOut();
                navigate("/login");
              }}
              className="text-sm text-ink-soft hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-3 sm:px-6 md:hidden">
          <StoreSelect id="header-store-mobile" />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <Outlet />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-2 px-4 py-6 text-xs text-ink-soft sm:px-6">
          <span>RetailPulse AI for NovaMart · prices include GST</span>
          <span>Signed in as {user?.name}{user?.membershipTier ? ` · ${user.membershipTier} member` : ""}</span>
        </div>
      </footer>
    </div>
  );
}
