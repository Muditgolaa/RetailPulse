// ──────────────────────────────────────────────────────────────────────────────
// HACKATHON DEMO ACCESS (temporary)
// One-click sign-in as a seeded demo account, no password. The server issues a
// real token through POST /api/auth/demo (only when DEMO_LOGIN_ENABLED=true).
// To remove: delete this file and its lines in pages/Login.jsx, the /demo route in
// backend/src/routes/auth.ts, or just set VITE_DEMO_ACCESS=false / DEMO_LOGIN_ENABLED=false.
// ──────────────────────────────────────────────────────────────────────────────
import { useState } from "react";

export const DEMO_ACCESS = import.meta.env.DEV && import.meta.env.VITE_DEMO_ACCESS !== "false";

const ACCOUNTS = [
  { account: "customer", title: "Customer", detail: "Priya · Gold", icon: "M5 7h14l-1.5 11h-11zM9 7a3 3 0 0 1 6 0" },
  { account: "manager", title: "Store manager", detail: "Rahul · DEL01", icon: "M4 20V9l8-5 8 5v11M9 20v-6h6v6" },
];

export default function DemoAccess({ onPick }) {
  const [busy, setBusy] = useState(null);

  async function pick(account) {
    setBusy(account);
    try {
      await onPick(account);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-lg border border-forest/25 bg-forest-soft/60 p-4" aria-labelledby="demo-access-title">
      <p id="demo-access-title" className="text-sm font-semibold text-forest">One-click demo access</p>
      <p className="mt-0.5 text-xs text-ink-soft">Signs in as a seeded demo account without a password.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {ACCOUNTS.map((a) => (
          <button
            key={a.account}
            type="button"
            onClick={() => pick(a.account)}
            disabled={Boolean(busy)}
            aria-busy={busy === a.account}
            aria-label={`Demo sign-in as ${a.title.toLowerCase()} (${a.detail})`}
            className="flex items-center gap-3 rounded-md border border-line bg-white px-3 py-2.5 text-left transition-colors hover:border-forest hover:bg-white/80 disabled:opacity-60"
          >
            {busy === a.account ? (
              <span className="size-5 shrink-0 animate-spin rounded-full border-2 border-forest border-r-transparent" aria-hidden />
            ) : (
              <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-forest" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={a.icon} />
              </svg>
            )}
            <span className="min-w-0">
              <span className="block text-sm font-medium">{a.title}</span>
              <span className="block truncate text-xs text-ink-soft">{a.detail}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
