import { useState } from "react";
import Button from "./ui/Button.jsx";

// Question input with example prompts, shared by both assistants.
export default function AskBox({ id, label, placeholder, examples, initial = "", loading, onAsk }) {
  const [text, setText] = useState(initial);
  const submit = (value) => {
    const q = value.trim();
    if (q) onAsk(q);
  };

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
        className="flex flex-col gap-3 rounded-lg border border-line bg-white p-3 sm:flex-row sm:items-end"
      >
        <label htmlFor={id} className="sr-only">{label}</label>
        <textarea
          id={id}
          rows={2}
          maxLength={500}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(text);
            }
          }}
          placeholder={placeholder}
          className="min-h-12 flex-1 resize-none bg-transparent px-1 text-base outline-none placeholder:text-ink-soft/70"
        />
        <Button type="submit" loading={loading} disabled={!text.trim()}>Ask</Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {examples.map((ex) => (
          <button
            key={ex}
            onClick={() => {
              setText(ex);
              submit(ex);
            }}
            disabled={loading}
            className="rounded-full border border-line px-3 py-1 text-sm text-ink-soft hover:border-ink/40 hover:text-ink disabled:opacity-50"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
