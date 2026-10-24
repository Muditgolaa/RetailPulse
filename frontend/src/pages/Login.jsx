import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import Button from "../components/ui/Button.jsx";
import DemoAccess, { DEMO_ACCESS } from "../components/DemoAccess.jsx"; // temporary hackathon demo access
import { errorMessage } from "../api/client.js";
import { demoLogin, login } from "../api/shop.js";
import { homeFor, useAuth } from "../store/auth.js";
import { useShop } from "../store/shop.js";

export default function Login() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={homeFor(user)} replace />;

  function enter({ token, user: signedIn }, demo = false) {
    signIn(signedIn, token, demo);
    if (signedIn.preferredStoreId) useShop.getState().setStoreId(signedIn.preferredStoreId);
    navigate(homeFor(signedIn), { replace: true });
  }

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      enter(await login(email.trim().toLowerCase(), password));
    } catch (err) {
      setError(err.response?.status === 401 ? "Email or password is incorrect." : errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function demo(account) {
    setError(null);
    try {
      enter(await demoLogin(account), true);
    } catch (err) {
      setError(err.response?.status === 404 ? "Demo access is turned off on the server (DEMO_LOGIN_ENABLED)." : errorMessage(err));
    }
  }

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
          <h2 className="font-display text-3xl">Sign in</h2>
          <p className="mt-1 text-sm text-ink-soft">Use your NovaMart customer or manager account.</p>

          {DEMO_ACCESS && (
            <div className="mt-8">
              <DemoAccess onPick={demo} />
              <p className="mt-6 flex items-center gap-3 text-xs uppercase tracking-widest text-ink-soft">
                <span className="h-px flex-1 bg-line" /> or sign in <span className="h-px flex-1 bg-line" />
              </p>
            </div>
          )}

          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              Email
              <input id="login-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-md border border-line bg-white px-3 text-base" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              Password
              <input id="login-password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-md border border-line bg-white px-3 text-base" />
            </label>
            {error && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            <Button type="submit" size="lg" loading={submitting}>Sign in</Button>
          </form>

        </div>
      </section>
    </div>
  );
}
