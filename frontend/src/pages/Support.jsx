import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import AskBox from "../components/AskBox.jsx";
import TicketStatus, { ticketCategoryLabel } from "../components/TicketStatus.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import { EmptyState, ErrorState } from "../components/ui/States.jsx";
import { errorMessage } from "../api/client.js";
import { listTickets, sendSupportMessage } from "../api/support.js";
import { useAsync } from "../lib/useAsync.js";

const EXAMPLES = ["Where is my order ORD-1023?", "Can I return an opened phone?", "I'd like to talk to a person about a late delivery"];
const HISTORY_SENT = 10; // the server accepts the last 10 messages as context

export default function Support() {
  const [params] = useSearchParams();
  const tickets = useAsync(() => listTickets(), []);
  const [messages, setMessages] = useState([]); // { role, content, toolsUsed?, ticket?, failed? }
  const [sending, setSending] = useState(false);
  const bottom = useRef(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  async function send(text) {
    const history = messages.filter((m) => !m.failed).slice(-HISTORY_SENT).map(({ role, content }) => ({ role, content }));
    setMessages((list) => [...list, { role: "user", content: text }]);
    setSending(true);
    try {
      const r = await sendSupportMessage(text, history);
      setMessages((list) => [...list, { role: "assistant", content: r.reply, toolsUsed: r.toolsUsed, ticket: r.ticket }]);
      if (r.ticket) tickets.reload();
    } catch (err) {
      setMessages((list) => [...list, { role: "assistant", content: errorMessage(err), failed: true }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10">
      <section className="flex flex-col gap-6">
        <header>
          <p className="text-xs uppercase tracking-[0.18em] text-forest">Support</p>
          <h1 className="mt-2 font-display text-4xl tracking-tight">How can we help?</h1>
          <p className="mt-2 text-ink-soft">
            The assistant can check your orders and NovaMart policies, and open a ticket for our team. It can't issue refunds or change orders.
          </p>
        </header>

        {messages.length > 0 && (
          <ol className="flex flex-col gap-4" aria-live="polite">
            {messages.map((m, i) => <ChatMessage key={i} message={m} />)}
            {sending && (
              <li className="max-w-[85%]">
                <Skeleton className="h-16 w-72" />
              </li>
            )}
          </ol>
        )}
        <div ref={bottom} />

        <AskBox id="support-message" label="Your message" placeholder="Ask about an order, a return, a delivery…"
          examples={messages.length === 0 ? EXAMPLES : []} initial={params.get("q") ?? ""} loading={sending} onAsk={send} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-2xl">My tickets</h2>
        {tickets.error ? (
          <ErrorState title="Couldn't load your tickets" error={tickets.error} onRetry={tickets.reload} />
        ) : tickets.loading ? (
          <Skeleton className="h-24 w-full" />
        ) : tickets.data.length === 0 ? (
          <EmptyState title="No tickets" message="If the assistant opens a ticket for you, it appears here with its status." />
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-white/60">
            {tickets.data.map((t) => (
              <li key={t.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    Ticket #{t.id} · {ticketCategoryLabel(t.category)}{t.order ? ` · ${t.order.code}` : ""}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-soft">{t.summary}</p>
                </div>
                <TicketStatus status={t.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ChatMessage({ message: m }) {
  if (m.role === "user") {
    return <li className="ml-auto max-w-[85%] rounded-lg bg-forest px-4 py-2.5 text-ivory">{m.content}</li>;
  }
  return (
    <li className="flex max-w-[85%] flex-col gap-2">
      {m.toolsUsed?.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="What the assistant checked">
          {m.toolsUsed.map((t, i) => <li key={i} className="rounded bg-ivory-deep px-2 py-0.5 text-xs text-ink-soft">{t.summary}</li>)}
        </ul>
      )}
      <p className={`whitespace-pre-line rounded-lg border px-4 py-2.5 ${m.failed ? "border-danger/25 bg-danger-soft text-danger" : "border-line bg-white/70"}`}>
        {m.content}
      </p>
      {m.ticket && (
        <p className="rounded-md border border-forest/30 bg-forest-soft/60 px-3 py-2 text-sm">
          Ticket #{m.ticket.id} opened · {ticketCategoryLabel(m.ticket.category)} · {m.ticket.priority.toLowerCase()} priority
        </p>
      )}
    </li>
  );
}
