import { useEffect, useState, type FormEvent } from "react";
import Button from "../components/ui/Button";
import Skeleton from "../components/ui/Skeleton";
import { ErrorState } from "../components/ui/States";
import { errorMessage } from "../api/client";
import { getFacets, listStores } from "../api/catalog";
import { savePreferences } from "../api/shop";
import { capitalize } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { useAuth } from "../store/auth";
import { useShop } from "../store/shop";
import { toast } from "../store/toast";
import type { Store, User } from "../types";

const MAX_BRANDS = 5;

export default function Account() {
  const user = useAuth((s) => s.user);
  const options = useAsync(async () => {
    const [stores, facets] = await Promise.all([listStores(), getFacets()]);
    return { stores, brands: facets.brands };
  }, []);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-forest">Account</p>
        <h1 className="mt-2 font-display text-4xl">{user?.name}</h1>
        <p className="mt-1 text-ink-soft">
          {user?.email} · {user?.membershipTier ? `${capitalize(user.membershipTier)} member` : ""}
        </p>
      </header>

      {options.error ? (
        <ErrorState title="Couldn't load your settings" error={options.error} onRetry={options.reload} />
      ) : options.loading ? (
        <Skeleton className="h-80 w-full" />
      ) : (
        <PreferencesForm user={user} stores={options.data.stores} brands={options.data.brands} />
      )}
    </div>
  );
}

function PreferencesForm({ user, stores, brands }: { user: User | null; stores: Store[]; brands: string[] }) {
  const setUser = useAuth((s) => s.setUser);
  const setStoreId = useShop((s) => s.setStoreId);
  const saved = user?.preferences ?? {};
  const [storeId, setStore] = useState<number | "">(user?.preferredStoreId ?? "");
  const [chosen, setChosen] = useState<string[]>(saved.brands ?? []);
  const [budget, setBudget] = useState<number | "">(saved.maxBudget ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refresh the form if the session sync brings newer values from the server.
  useEffect(() => {
    setStore(user?.preferredStoreId ?? "");
    setChosen(user?.preferences?.brands ?? []);
    setBudget(user?.preferences?.maxBudget ?? "");
  }, [user]);

  const toggleBrand = (brand: string) =>
    setChosen((list) => (list.includes(brand) ? list.filter((b) => b !== brand) : list.length < MAX_BRANDS ? [...list, brand] : list));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await savePreferences({
        preferredStoreId: storeId === "" ? null : Number(storeId),
        brands: chosen,
        maxBudget: budget === "" ? null : Number(budget),
      });
      setUser(updated);
      if (updated.preferredStoreId) setStoreId(updated.preferredStoreId);
      toast.success("Preferences saved", "The shopping assistant will use them.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8 rounded-lg border border-line bg-white/60 p-6">
      <div>
        <h2 className="font-display text-2xl">Shopping preferences</h2>
        <p className="mt-1 text-sm text-ink-soft">
          The shopping assistant uses your budget when a request doesn't mention one, and prefers your brands when two products match equally well.
        </p>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        Home store
        <select id="pref-store" value={storeId} onChange={(e) => setStore(e.target.value === "" ? "" : Number(e.target.value))} className="h-11 rounded-md border border-line bg-white px-3 text-base">
          <option value="">No preference</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}, {s.city}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        Usual budget (₹)
        <input
          id="pref-budget"
          type="number"
          inputMode="numeric"
          min={500}
          max={1000000}
          step={500}
          value={budget}
          onChange={(e) => setBudget(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="e.g. 80000"
          className="h-11 rounded-md border border-line bg-white px-3 text-base"
        />
        <span className="text-xs text-ink-soft">Leave empty for no budget.</span>
      </label>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1">Favourite brands <span className="text-ink-soft">({chosen.length}/{MAX_BRANDS})</span></legend>
        <div className="flex flex-wrap gap-2">
          {brands.map((brand) => {
            const on = chosen.includes(brand);
            const disabled = !on && chosen.length >= MAX_BRANDS;
            return (
              <button
                key={brand}
                type="button"
                aria-pressed={on}
                disabled={disabled}
                onClick={() => toggleBrand(brand)}
                className={`rounded-full border px-3 py-1 transition-colors disabled:opacity-40 ${on ? "border-forest bg-forest text-ivory" : "border-line hover:border-ink/40"}`}
              >
                {brand}
              </button>
            );
          })}
        </div>
      </fieldset>

      {error && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">Not saved. {error}</p>}

      <Button type="submit" size="lg" loading={saving} className="self-start">Save preferences</Button>
    </form>
  );
}
