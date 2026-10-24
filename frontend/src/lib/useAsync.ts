import { useCallback, useEffect, useState, type DependencyList } from "react";

// Exactly one of: still loading, failed with an error, or finished with data.
export type AsyncState<T> =
  | { loading: true; error: null; data: null }
  | { loading: false; error: Error; data: null }
  | { loading: false; error: null; data: T };

const LOADING = { loading: true, error: null, data: null } as const;

// Runs an async loader and tracks its state. `reload()` runs it again.
export function useAsync<T>(loader: () => Promise<T>, deps: DependencyList): AsyncState<T> & { reload: () => () => void } {
  const [state, setState] = useState<AsyncState<T>>(LOADING);

  // `deps` decide when the loader runs again (like useEffect deps).
  const run = useCallback(loader, deps);

  const reload = useCallback(() => {
    let cancelled = false;
    setState(LOADING);
    run()
      .then((data) => !cancelled && setState({ loading: false, error: null, data }))
      .catch((err: unknown) => !cancelled && setState({ loading: false, error: err instanceof Error ? err : new Error(String(err)), data: null }));
    return () => {
      cancelled = true;
    };
  }, [run]);

  useEffect(() => reload(), [reload]);

  return { ...state, reload };
}
