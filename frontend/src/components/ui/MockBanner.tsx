import { useAuth } from "../../store/auth";

// Shown while signed in through the temporary one-click demo access.
export default function MockBanner({ dark = false }) {
  const demo = useAuth((s) => s.demo);
  if (!demo) return null;
  return (
    <div className={`px-4 py-2 text-center text-xs ${dark ? "bg-ops-amber/10 text-ops-amber" : "bg-amber-soft text-amber"}`}>
      <span className="font-semibold">Demo · </span>Signed in through one-click demo access.
    </div>
  );
}
