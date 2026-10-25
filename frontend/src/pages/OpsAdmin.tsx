import { useState } from "react";
import Button from "../components/ui/Button";
import Skeleton from "../components/ui/Skeleton";
import { EmptyState, ErrorState } from "../components/ui/States";
import { errorMessage } from "../api/client";
import { getSiteSettings, listUsers, updateSiteSettings, updateUser } from "../api/admin";
import { capitalize } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { useAuth } from "../store/auth";
import { toast } from "../store/toast";
import type { AdminUser, MembershipTier, Role, SiteSettings } from "../types";

const ROLES: Role[] = ["CUSTOMER", "MANAGER", "ADMIN"];
const TIERS: MembershipTier[] = ["STANDARD", "SILVER", "GOLD", "PLATINUM"];
const select = "h-9 rounded-md border border-ops-line bg-ops-bg px-2 text-sm text-ops-text disabled:opacity-50";

// Admin console: change how the site behaves and who can do what, without touching code or redeploying.
export default function OpsAdmin() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-ops-muted">Admin</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Site settings and users</h1>
        <p className="mt-1 max-w-2xl text-sm text-ops-muted">Changes apply immediately for every visitor and are recorded in the audit history.</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[24rem_1fr]">
        <SettingsPanel />
        <UsersPanel />
      </div>
    </div>
  );
}

const SETTINGS: { key: keyof SiteSettings; title: string; detail: string }[] = [
  {
    key: "demoAccess",
    title: "One-click demo access",
    detail: "Shows “Try the demo” on the sign-in page, so visitors can sign in as the sample customer or manager without a password.",
  },
  { key: "signupEnabled", title: "Allow new sign-ups", detail: "Anyone can create a customer account. Emails listed in ADMIN_EMAILS can always sign up." },
];

function SettingsPanel() {
  const settings = useAsync(() => getSiteSettings(), []);
  const [saving, setSaving] = useState<keyof SiteSettings | null>(null);

  async function toggle(key: keyof SiteSettings, value: boolean) {
    setSaving(key);
    try {
      await updateSiteSettings({ [key]: value });
      toast.success("Setting saved", `${SETTINGS.find((s) => s.key === key)?.title}: ${value ? "on" : "off"}`);
      settings.reload();
    } catch (err) {
      toast.error("Not saved", errorMessage(err));
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="h-fit rounded-lg border border-ops-line bg-ops-panel">
      <h2 className="border-b border-ops-line px-4 py-3 font-medium">Site settings</h2>
      <div className="p-4">
        {settings.error ? (
          <ErrorState dark title="Couldn't load settings" error={settings.error} onRetry={settings.reload} />
        ) : settings.loading ? (
          <Skeleton className="h-32 w-full text-ops-text" />
        ) : (
          <ul className="flex flex-col gap-4">
            {SETTINGS.map((s) => {
              const on = settings.data[s.key];
              return (
                <li key={s.key} className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="mt-0.5 text-xs text-ops-muted">{s.detail}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={s.title}
                    disabled={saving !== null}
                    onClick={() => toggle(s.key, !on)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-ops-emerald" : "bg-ops-raised"}`}
                  >
                    <span className={`absolute top-0.5 size-5 rounded-full bg-ops-text transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function UsersPanel() {
  const me = useAuth((s) => s.user);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const users = useAsync(() => listUsers(search || undefined), [search]);
  const [busy, setBusy] = useState<number | null>(null);

  async function change(user: AdminUser, changes: { role?: Role; membershipTier?: MembershipTier }) {
    setBusy(user.id);
    try {
      await updateUser(user.id, changes);
      toast.success("User updated", `${user.name}: ${changes.role ? capitalize(changes.role) : `${capitalize(changes.membershipTier!)} member`}`);
      users.reload();
    } catch (err) {
      toast.error("Not updated", errorMessage(err));
      users.reload(); // put the dropdown back to the saved value
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="min-w-0 rounded-lg border border-ops-line bg-ops-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ops-line px-4 py-3">
        <h2 className="font-medium">Users</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query.trim());
          }}
          className="flex gap-2"
        >
          <label htmlFor="user-search" className="sr-only">Search users</label>
          <input id="user-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or email" className={`${select} w-48 px-3`} />
          <Button type="submit" variant="opsOutline" size="sm">Search</Button>
        </form>
      </div>
      <div className="p-4">
        {users.error ? (
          <ErrorState dark title="Couldn't load users" error={users.error} onRetry={users.reload} />
        ) : users.loading ? (
          <Skeleton className="h-48 w-full text-ops-text" />
        ) : users.data.length === 0 ? (
          <EmptyState dark title="No users found" message="Try another name or email." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[38rem] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-ops-muted">
                  <th className="py-2 pr-3 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Membership</th>
                  <th className="px-3 py-2 text-right font-medium">Orders</th>
                  <th className="py-2 pl-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ops-line">
                {users.data.map((u) => {
                  const isMe = u.id === me?.id;
                  return (
                    <tr key={u.id}>
                      <td className="py-2.5 pr-3">
                        <p className="font-medium">{u.name}{isMe && <span className="ml-2 text-xs text-ops-muted">(you)</span>}</p>
                        <p className="font-mono text-xs text-ops-muted">{u.email}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <select aria-label={`Role for ${u.name}`} value={u.role} disabled={busy !== null || isMe} onChange={(e) => change(u, { role: e.target.value as Role })} className={select}>
                          {ROLES.map((r) => <option key={r} value={r}>{capitalize(r)}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        <select aria-label={`Membership for ${u.name}`} value={u.membershipTier} disabled={busy !== null} onChange={(e) => change(u, { membershipTier: e.target.value as MembershipTier })} className={select}>
                          {TIERS.map((t) => <option key={t} value={t}>{capitalize(t)}</option>)}
                        </select>
                      </td>
                      <td className="tabular px-3 py-2.5 text-right font-mono">{u._count.orders}</td>
                      <td className="py-2.5 pl-3 font-mono text-xs text-ops-muted">{new Date(u.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
