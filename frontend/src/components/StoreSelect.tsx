import { useEffect, useState } from "react";
import { listStores } from "../api/catalog";
import { useShop } from "../store/shop";
import type { Store } from "../types";

// Shared store picker. `dark` styles it for the operations area.
export default function StoreSelect({ dark = false, id = "store-select" }) {
  const { storeId, setStoreId } = useShop();
  const [stores, setStores] = useState<Store[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    listStores().then(setStores).catch(() => setFailed(true));
  }, []);

  const style = dark
    ? "border-ops-line bg-ops-panel text-ops-text"
    : "border-line bg-white/60 text-ink";

  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <span className={dark ? "text-ops-muted" : "text-ink-soft"}>Store</span>
      <select
        id={id}
        value={storeId}
        onChange={(e) => setStoreId(e.target.value)}
        disabled={failed || stores.length === 0}
        className={`h-9 rounded-md border px-2 pr-7 text-sm ${style}`}
      >
        {failed && <option>Unavailable</option>}
        {!failed && stores.length === 0 && <option>Loading…</option>}
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.code} · {s.city}
          </option>
        ))}
      </select>
    </label>
  );
}

export function useStoreName(storeId: number) {
  const [name, setName] = useState("");
  useEffect(() => {
    listStores()
      .then((stores) => setName(stores.find((s) => s.id === storeId)?.name ?? ""))
      .catch(() => setName(""));
  }, [storeId]);
  return name;
}
