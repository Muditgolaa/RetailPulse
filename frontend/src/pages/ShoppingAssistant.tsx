import { useSearchParams } from "react-router";
import AskBox from "../components/AskBox";
import RecommendationResults from "../components/assistant/RecommendationResults";
import { RECOMMEND_EXAMPLES } from "../components/assistant/RecommendDrawer";
import { useRecommend } from "../components/assistant/useRecommend";

export default function ShoppingAssistant() {
  const [params] = useSearchParams();
  const rec = useRecommend();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-forest">Shopping assistant</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight">Describe what you need.</h1>
        <p className="mt-2 text-ink-soft">Recommendations come only from NovaMart's catalogue, with prices and stock from your selected store.</p>
      </header>

      <AskBox id="assistant-query" label="What are you looking for?" placeholder="e.g. A light laptop for coding under ₹70,000"
        examples={RECOMMEND_EXAMPLES} initial={params.get("q") ?? ""} loading={rec.loading} onAsk={rec.ask} />

      <RecommendationResults {...rec} onRetry={rec.retry} />
    </div>
  );
}
