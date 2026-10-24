import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import AskBox from "../components/AskBox";
import Skeleton from "../components/ui/Skeleton";
import { ErrorState } from "../components/ui/States";
import { askPolicy } from "../api/shop";
import { capitalize } from "../lib/format";
import { useAuth } from "../store/auth";
import type { AskResponse, PolicySource } from "../types";

type State = { loading: boolean; error: unknown; result: AskResponse | null; question: string };

const EXAMPLES = [
  "Can I return an opened phone?",
  "Is express delivery free for Gold members?",
  "How long do refunds take?",
  "Can I pay with Bitcoin?",
];

// Evidence strength comes from how closely the cited sections match the question. It is not a probability of correctness.
const EVIDENCE: Record<AskResponse["confidence"], { label: string; style: string }> = {
  HIGH: { label: "Strong match in policy", style: "bg-forest-soft text-forest" },
  MEDIUM: { label: "Good match in policy", style: "bg-amber-soft text-amber" },
  LOW: { label: "Weak match in policy", style: "bg-ivory-deep text-ink-soft" },
};

export default function PolicyAssistant() {
  const [params] = useSearchParams();
  const user = useAuth((s) => s.user);
  const [state, setState] = useState<State>({ loading: false, error: null, result: null, question: "" });

  async function ask(question: string) {
    setState({ loading: true, error: null, result: null, question });
    try {
      setState({ loading: false, error: null, result: await askPolicy(question), question });
    } catch (error) {
      setState({ loading: false, error, result: null, question });
    }
  }

  const r = state.result;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-forest">Policy help</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight">Returns, warranty, delivery and membership.</h1>
        <p className="mt-2 text-ink-soft">Answers come only from NovaMart's approved policy documents, with the exact sections shown.</p>
        <p className="mt-3 inline-flex rounded-full border border-line px-3 py-1 text-xs text-ink-soft">
          Showing policies for {user?.country === "IN" ? "India" : user?.country} · {user?.membershipTier ? `${capitalize(user.membershipTier)} member` : "all members"}
        </p>
      </header>

      <AskBox id="policy-question" label="Your question" placeholder="Ask about returns, warranty, delivery, payments or membership"
        examples={EXAMPLES} initial={params.get("q") ?? ""} loading={state.loading} onAsk={ask} />

      {state.loading && (
        <div className="flex flex-col gap-3" aria-busy="true">
          <p className="text-sm text-ink-soft">Searching the policy documents…</p>
          <Skeleton className="h-36 w-full" />
        </div>
      )}

      {state.error != null && <ErrorState title="The policy assistant couldn't answer" error={state.error} onRetry={() => ask(state.question)} />}

      {r && <PolicyAnswer result={r} question={state.question} />}
    </div>
  );
}

function PolicyAnswer({ result: r, question }: { result: AskResponse; question: string }) {
  if (r.status === "NOT_FOUND") {
    return (
      <article className="rounded-lg border border-line bg-ivory-deep/60 p-5" aria-live="polite">
        <p className="text-sm text-ink-soft">{question}</p>
        <p className="mt-2 font-medium">Not covered by NovaMart's approved policies</p>
        <p className="mt-1 text-sm text-ink-soft">{r.answer}</p>
        <Link to={`/support?q=${encodeURIComponent(question)}`} className="mt-3 inline-block text-sm text-forest hover:underline">
          Ask support about this
        </Link>
      </article>
    );
  }

  const evidence = EVIDENCE[r.confidence];
  return (
    <article className="flex flex-col gap-4 rounded-lg border border-line bg-white/70 p-5" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-ink-soft">{question}</p>
        {r.status === "ANSWERED" && (
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${evidence.style}`}
            title="How closely the cited policy sections match your question. Not a guarantee that the answer is correct.">
            {evidence.label}
          </span>
        )}
      </div>

      {r.status === "SOURCES_ONLY" ? (
        <p className="rounded-md bg-amber-soft px-3 py-2 text-sm text-amber">{r.answer}</p>
      ) : (
        <p className="leading-relaxed">{r.answer}</p>
      )}

      {r.followUpRequired && r.status === "ANSWERED" && (
        <p className="text-sm text-ink-soft">The policy match is weak, so please confirm with NovaMart Support before relying on this.</p>
      )}

      <div>
        <p className="text-xs uppercase tracking-wider text-ink-soft">{r.status === "ANSWERED" ? "Sources" : "Relevant sections"}</p>
        <ul className="mt-2 flex flex-col gap-2">
          {r.sources.map((s) => <SourceItem key={s.id} source={s} open={r.status === "SOURCES_ONLY"} />)}
        </ul>
      </div>
    </article>
  );
}

function SourceItem({ source: s, open }: { source: PolicySource; open: boolean }) {
  return (
    <li>
      <details open={open} className="group rounded-md border border-line bg-ivory">
        <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-2 text-sm">
          <span className="font-medium">{s.document}</span>
          <span className="text-ink-soft">› {s.section}</span>
          <span className="ml-auto text-xs text-ink-soft">v{s.version} · effective {s.effectiveDate}</span>
        </summary>
        <p className="whitespace-pre-line border-t border-line px-3 py-2 text-sm leading-relaxed text-ink-soft">{s.excerpt}</p>
      </details>
    </li>
  );
}
