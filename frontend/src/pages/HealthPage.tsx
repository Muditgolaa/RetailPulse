import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { api } from "../api/client";
import type { Health } from "../types";

type State = { loading: boolean; data: Health | null; error: string | null };

export default function HealthPage() {
  const [state, setState] = useState<State>({ loading: true, data: null, error: null });

  const check = useCallback(async () => {
    setState({ loading: true, data: null, error: null });
    try {
      const res = await api.get<Health>("/health");
      setState({ loading: false, data: res.data, error: null });
    } catch (err) {
      // A 503 still has a JSON body: backend is up but the database is not.
      const body = axios.isAxiosError<Health>(err) ? (err.response?.data ?? null) : null;
      setState({ loading: false, data: body, error: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const backendUp = Boolean(state.data);
  const dbUp = state.data?.database === "up";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16 text-slate-900">
      <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">RetailPulse AI</h1>
        <p className="mt-1 text-sm text-slate-500">System status</p>

        <ul className="mt-6 space-y-3">
          <StatusRow label="Backend API" loading={state.loading} ok={backendUp} />
          <StatusRow label="Database" loading={state.loading} ok={dbUp} />
        </ul>

        {state.error && !backendUp && (
          <p className="mt-4 text-sm text-red-600">
            Could not reach the backend ({state.error}). Is it running on port 4000?
          </p>
        )}

        <button
          onClick={check}
          className="mt-6 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Check again
        </button>
      </div>
    </main>
  );
}

function StatusRow({ label, loading, ok }: { label: string; loading: boolean; ok: boolean }) {
  const text = loading ? "Checking…" : ok ? "Connected" : "Not connected";
  const color = loading ? "bg-slate-100 text-slate-600" : ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";
  return (
    <li className="flex items-center justify-between">
      <span>{label}</span>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${color}`}>{text}</span>
    </li>
  );
}
