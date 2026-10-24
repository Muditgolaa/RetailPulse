import { useToast } from "../../store/toast";

const tones = {
  success: "border-l-forest",
  error: "border-l-danger",
  info: "border-l-ink-soft",
};

export default function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border border-line border-l-4 bg-white px-4 py-3 text-ink shadow-lg ${tones[t.tone]}`}
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t.title}</p>
            {t.message && <p className="mt-0.5 text-sm text-ink-soft">{t.message}</p>}
          </div>
          <button onClick={() => dismiss(t.id)} className="text-ink-soft hover:text-ink" aria-label="Dismiss notification">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
