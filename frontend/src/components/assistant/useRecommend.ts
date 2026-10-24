import { useState } from "react";
import { recommend } from "../../api/shop";
import { useShop } from "../../store/shop";
import type { RecommendResponse } from "../../types";

type State = { loading: boolean; error: unknown; result: RecommendResponse | null; query: string };

// Request state for POST /api/ai/recommend, shared by the drawer and the assistant page.
export function useRecommend() {
  const storeId = useShop((s) => s.storeId);
  const [state, setState] = useState<State>({ loading: false, error: null, result: null, query: "" });

  async function ask(query: string) {
    setState({ loading: true, error: null, result: null, query });
    try {
      setState({ loading: false, error: null, result: await recommend(query, storeId), query });
    } catch (error) {
      setState({ loading: false, error, result: null, query });
    }
  }

  return { ...state, ask, retry: () => ask(state.query) };
}
