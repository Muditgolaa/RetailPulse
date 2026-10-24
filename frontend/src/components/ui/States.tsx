import type { ReactNode } from "react";
import Button from "./Button";
import { errorMessage } from "../../api/client";

type EmptyStateProps = { title: string; message?: string; action?: ReactNode; dark?: boolean };

export function EmptyState({ title, message, action, dark = false }: EmptyStateProps) {
  return (
    <div className={`rounded-lg border border-dashed px-6 py-12 text-center ${dark ? "border-ops-line text-ops-muted" : "border-line text-ink-soft"}`}>
      <p className={`font-medium ${dark ? "text-ops-text" : "text-ink"}`}>{title}</p>
      {message && <p className="mx-auto mt-1 max-w-md text-sm">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

type ErrorStateProps = { error: unknown; title?: string; onRetry?: () => void; dark?: boolean };

export function ErrorState({ error, title = "Something went wrong", onRetry, dark = false }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`rounded-lg border px-6 py-8 text-center ${dark ? "border-ops-red/30 bg-ops-red/5 text-ops-text" : "border-danger/25 bg-danger-soft text-ink"}`}
    >
      <p className="font-medium">{title}</p>
      <p className={`mx-auto mt-1 max-w-md text-sm ${dark ? "text-ops-muted" : "text-ink-soft"}`}>{errorMessage(error)}</p>
      {onRetry && (
        <Button variant={dark ? "opsOutline" : "outline"} size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
