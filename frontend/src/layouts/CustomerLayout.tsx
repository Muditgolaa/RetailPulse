import { Link, NavLink, Outlet, useNavigate } from "react-router";
import MockBanner from "../components/ui/MockBanner";
import StoreSelect from "../components/StoreSelect";
import { cartCount, useCart } from "../store/cart";
import { useAuth } from "../store/auth";
import { capitalize } from "../lib/format";

const NAV = [
  { to: "/", label: "Shop", end: true },
  { to: "/assistant", label: "Shopping assistant" },
  { to: "/policy", label: "Policies" },
  { to: "/orders", label: "Orders" },
  { to: "/support", label: "Support" },
];

const navLink = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 border-b-2 py-3 text-sm ${isActive ? "border-forest text-ink" : "border-transparent text-ink-soft hover:text-ink"}`;

// Two rows: brand, store and account actions on top; section links below (scrolls sideways on phones).
export default function CustomerLayout() {
  const items = useCart((s) => s.items);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const count = cartCount(items);

  return (
    <div className="min-h-screen bg-ivory">
      <MockBanner />
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 pt-4 sm:px-6">
          <Link to="/" className="shrink-0 font-display text-2xl tracking-tight">
            RetailPulse<span className="ml-1 align-super font-sans text-[0.6rem] font-semibold tracking-widest text-forest">AI</span>
          </Link>
          <div className="ml-auto flex items-center gap-3 whitespace-nowrap sm:gap-5">
            <div className="hidden md:block">
              <StoreSelect id="header-store" />
            </div>
            <Link to="/cart" className="rounded-md px-2 py-1 text-sm hover:bg-ivory-deep" aria-label={`Cart, ${count} items`}>
              Cart
              <span className="tabular ml-1.5 inline-flex min-w-5 justify-center rounded-full bg-ink px-1.5 text-xs leading-5 text-ivory">{count}</span>
            </Link>
            <NavLink to="/account" className={({ isActive }) => `text-sm ${isActive ? "text-ink" : "text-ink-soft hover:text-ink"}`}>
              Account
            </NavLink>
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

        <div className="mx-auto max-w-7xl px-4 pt-3 sm:px-6 md:hidden">
          <StoreSelect id="header-store-mobile" />
        </div>

        <nav className="no-scrollbar mx-auto mt-1 flex max-w-7xl gap-6 overflow-x-auto px-4 sm:px-6" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={navLink}>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <Outlet />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-2 px-4 py-6 text-xs text-ink-soft sm:px-6">
          <span>RetailPulse AI for NovaMart · prices include GST</span>
          <span>
            Signed in as {user?.name}
            {user?.membershipTier ? ` · ${capitalize(user.membershipTier)} member` : ""}
          </span>
        </div>
      </footer>
    </div>
  );
}
