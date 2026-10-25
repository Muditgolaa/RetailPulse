import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import Button from "../components/ui/Button";
import DemoAccess from "../components/DemoAccess";
import { errorMessage, httpStatus } from "../api/client";
import { getSiteSettings } from "../api/admin";
import { demoLogin, login, register } from "../api/shop";
import { homeFor, useAuth } from "../store/auth";
import { useShop } from "../store/shop";
import type { SiteSettings, User } from "../types";

type Mode = "signin" | "signup";
const input = "h-11 rounded-md border border-line bg-white px-3 text-base";

export default function Login() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Demo access and sign-ups are switched on and off by admins, so read them from the server.
  useEffect(() => {
    getSiteSettings().then(setSettings).catch(() => setSettings({ demoAccess: false, signupEnabled: true }));
  }, []);

  if (user) return <Navigate to={homeFor(user)} replace />;

  function enter({ token, user: signedIn }: { token: string; user: User }, demo = false) {
    signIn(signedIn, token, demo);
    if (signedIn.preferredStoreId) useShop.getState().setStoreId(signedIn.preferredStoreId);
    navigate(homeFor(signedIn), { replace: true });
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const address = email.trim().toLowerCase();
      enter(mode === "signin" ? await login(address, password) : await register(name.trim(), address, password));
    } catch (err) {
      setError(mode === "signin" && httpStatus(err) === 401 ? "Email or password is incorrect." : errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function demo(account: "customer" | "manager") {
    setError(null);
    try {
      enter(await demoLogin(account), true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const signup = mode === "signup";
  const tab = (key: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === key}
      onClick={() => switchMode(key)}
      className={`flex-1 border-b-2 pb-2 text-sm ${mode === key ? "border-forest font-medium text-ink" : "border-transparent text-ink-soft hover:text-ink"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="flex flex-col justify-between bg-forest px-8 py-10 text-ivory sm:px-12 lg:py-14">
        <p className="font-display text-2xl">RetailPulse<span className="ml-1 align-super font-sans text-[0.6rem] font-semibold tracking-widest">AI</span></p>
        <div className="my-16 max-w-md lg:my-0">
          <h1 className="font-display text-4xl leading-tight text-balance sm:text-5xl">Shopping and store operations for NovaMart.</h1>
          <p className="mt-4 text-ivory/75">
            Customers find products in stock nearby and get answers backed by store policy. Managers see what needs restocking and approve every change.
          </p>
        </div>
        <p className="text-sm text-ivory/60">Delhi · Gurugram · Noida · Faridabad</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-3xl">{signup ? "Create your account" : "Welcome back"}</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {signup ? "Shop, ask about policies and track your orders." : "Sign in to your NovaMart account."}
          </p>

          {settings?.demoAccess && (
            <div className="mt-8">
              <DemoAccess onPick={demo} />
              <p className="mt-6 flex items-center gap-3 text-xs uppercase tracking-widest text-ink-soft">
                <span className="h-px flex-1 bg-line" /> or use your account <span className="h-px flex-1 bg-line" />
              </p>
            </div>
          )}

          <div role="tablist" className="mt-6 flex gap-4">
            {tab("signin", "Sign in")}
            {settings?.signupEnabled !== false && tab("signup", "Create account")}
          </div>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
            {signup && (
              <label className="flex flex-col gap-1.5 text-sm">
                Name
                <input id="signup-name" required minLength={2} maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={input} />
              </label>
            )}
            <label className="flex flex-col gap-1.5 text-sm">
              Email
              <input id="login-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              Password
              <input
                id="login-password"
                type="password"
                required
                minLength={signup ? 8 : undefined}
                autoComplete={signup ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={input}
              />
              {signup && <span className="text-xs text-ink-soft">At least 8 characters.</span>}
            </label>
            {error && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            <Button type="submit" size="lg" loading={submitting}>{signup ? "Create account" : "Sign in"}</Button>
          </form>

          {settings?.signupEnabled === false && (
            <p className="mt-6 text-center text-sm text-ink-soft">New sign-ups are closed right now.</p>
          )}
        </div>
      </section>
    </div>
  );
}
