import { useEffect, useRef } from "react";
import AskBox from "../AskBox";
import RecommendationResults from "./RecommendationResults";
import { useRecommend } from "./useRecommend";

export const RECOMMEND_EXAMPLES = [
  "Recommend a laptop under ₹80,000 for Java development, Docker, and some gaming.",
  "A phone with a great battery under ₹30,000",
  "Noise-cancelling headphones for travel",
];

// Right-side panel with the shopping assistant, opened from the storefront.
export default function RecommendDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rec = useRecommend();
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panel.current?.querySelector("textarea")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button className="absolute inset-0 bg-ink/30" onClick={onClose} aria-label="Close shopping assistant" tabIndex={-1} />
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recommend-title"
        className="relative flex h-full w-full max-w-xl flex-col gap-5 overflow-y-auto bg-ivory px-5 py-6 shadow-2xl sm:px-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-forest">Shopping assistant</p>
            <h2 id="recommend-title" className="mt-1 font-display text-2xl">Describe what you need</h2>
            <p className="mt-1 text-sm text-ink-soft">Only real NovaMart products, with prices and stock for your store.</p>
          </div>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-ink-soft hover:bg-ivory-deep hover:text-ink" aria-label="Close">✕</button>
        </div>
        <AskBox id="drawer-query" label="What are you looking for?" placeholder="e.g. A light laptop for coding under ₹70,000"
          examples={RECOMMEND_EXAMPLES} loading={rec.loading} onAsk={rec.ask} />
        <RecommendationResults {...rec} onRetry={rec.retry} compact />
      </aside>
    </div>
  );
}
