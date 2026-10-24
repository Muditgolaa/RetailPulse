import { useCallback, useEffect, useState } from "react";

// Runs an async loader and tracks loading / error / data. `reload()` runs it again.
export function useAsync(loader, deps) {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  // `deps` decide when the loader runs again (like useEffect deps).
  const run = useCallback(loader, deps);

  const reload = useCallback(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    run()
      .then((data) => !cancelled && setState({ loading: false, error: null, data }))
      .catch((error) => !cancelled && setState({ loading: false, error, data: null }));
    return () => {
      cancelled = true;
    };
  }, [run]);

  useEffect(() => reload(), [reload]);

  return { ...state, reload };
}
