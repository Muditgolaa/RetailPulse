import { useState, type ChangeEvent, type FormEvent } from "react";
import Button from "../components/ui/Button";
import Skeleton from "../components/ui/Skeleton";
import { EmptyState, ErrorState } from "../components/ui/States";
import { errorMessage } from "../api/client";
import { deleteDocument, listDocuments, uploadDocument } from "../api/kb";
import { useAsync } from "../lib/useAsync";
import { toast } from "../store/toast";
import type { AsyncState } from "../lib/useAsync";
import type { KbDocument, KbUpload, KbUploadResult } from "../types";

const DOC_TYPES = ["RETURN_POLICY", "SHIPPING_POLICY", "MEMBERSHIP", "WARRANTY", "PAYMENT_POLICY", "PRODUCT_MANUAL", "STORE_PROCEDURE", "OTHER"];
const TIERS = ["ALL", "STANDARD", "SILVER", "GOLD", "PLATINUM"];
const MAX_FILE_BYTES = 100_000;

const label = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");
const field = "h-10 rounded-md border border-ops-line bg-ops-bg px-3 text-sm text-ops-text";

// Knowledge base management: upload policy documents for the policy assistant and support agent.
export default function OpsKnowledge() {
  const docs = useAsync(() => listDocuments(), []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-ops-muted">Knowledge base</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Policy documents</h1>
        <p className="mt-1 max-w-2xl text-sm text-ops-muted">
          Customers' policy questions and the support assistant are answered only from these documents. Uploads are split into sections at each
          "## " heading and are searchable straight away.
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[26rem_1fr]">
        <UploadForm onUploaded={docs.reload} />
        <DocumentTable docs={docs} />
      </div>
    </div>
  );
}

function UploadForm({ onUploaded }: { onUploaded: () => void }) {
  const empty: KbUpload = { title: "", docType: "STORE_PROCEDURE", version: "1.0", effectiveDate: new Date().toISOString().slice(0, 10), tier: "ALL", category: "ALL", content: "" };
  const [form, setForm] = useState<KbUpload>(empty);
  const [fileName, setFileName] = useState("");
  const [fileKey, setFileKey] = useState(0); // remounts the file input so it clears after an upload
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<KbUploadResult | null>(null);
  const set = (key: keyof KbUpload) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError(null);
    setResult(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError("The file is larger than 100 KB.");
      return;
    }
    const text = await file.text();
    const heading = text.match(/^# (.+)$/m)?.[1]?.trim();
    setFileName(file.name);
    setForm((f) => ({ ...f, content: text, title: f.title || heading || file.name.replace(/\.(md|txt)$/i, "") }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setUploading(true);
    setError(null);
    try {
      const r = await uploadDocument(form);
      setResult(r);
      toast.success(r.unchanged ? "Already up to date" : "Document added", `${r.title} · ${r.chunks} section${r.chunks === 1 ? "" : "s"}`);
      setForm(empty);
      setFileName("");
      setFileKey((k) => k + 1);
      onUploaded();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex h-fit flex-col gap-4 rounded-lg border border-ops-line bg-ops-panel p-4">
      <h2 className="font-medium">Upload a document</h2>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ops-muted">Markdown or text file (up to 100 KB)</span>
        <input key={fileKey} id="kb-file" type="file" accept=".md,.txt,text/markdown,text/plain" onChange={pickFile}
          className="text-sm text-ops-muted file:mr-3 file:rounded-md file:border-0 file:bg-ops-raised file:px-3 file:py-2 file:text-ops-text" />
        {fileName && <span className="font-mono text-xs text-ops-muted">{fileName} · {form.content.length.toLocaleString("en-IN")} characters</span>}
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ops-muted">Title</span>
        <input id="kb-title" required value={form.title} onChange={set("title")} className={field} placeholder="e.g. Gift Wrapping Service" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-ops-muted">Type</span>
          <select id="kb-type" value={form.docType} onChange={set("docType")} className={field}>
            {DOC_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-ops-muted">Visible to</span>
          <select id="kb-tier" value={form.tier} onChange={set("tier")} className={field}>
            {TIERS.map((t) => <option key={t} value={t}>{t === "ALL" ? "All members" : `${label(t)} members`}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-ops-muted">Version</span>
          <input id="kb-version" required value={form.version} onChange={set("version")} className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-ops-muted">Effective from</span>
          <input id="kb-date" type="date" required value={form.effectiveDate} onChange={set("effectiveDate")} className={field} />
        </label>
      </div>

      {error && <p role="alert" className="rounded-md bg-ops-red/10 px-3 py-2 text-sm text-ops-red">Not uploaded. {error}</p>}
      {result && (
        <div className="rounded-md bg-ops-emerald/10 px-3 py-2 text-sm">
          <p className="text-ops-emerald">
            {result.unchanged ? "No changes: this version is already indexed." : `Indexed ${result.chunks} section${result.chunks === 1 ? "" : "s"}`}
            {result.replacedVersion ? ` · replaced v${result.replacedVersion}` : ""}
          </p>
          <p className="mt-1 text-ops-muted">{result.sections.join(" · ")}</p>
        </div>
      )}

      <Button type="submit" variant="opsPrimary" loading={uploading} disabled={!form.content} className="self-start">
        Upload and index
      </Button>
      <p className="text-xs text-ops-muted">Uploading a document with the same title replaces its previous version. Effective dates in the future stay hidden until that day.</p>
    </form>
  );
}

function DocumentTable({ docs }: { docs: AsyncState<KbDocument[]> & { reload: () => void } }) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function remove(documentId: string) {
    setDeleting(true);
    try {
      await deleteDocument(documentId);
      toast.success("Document removed", "It will no longer be used for answers.");
      setConfirming(null);
      docs.reload();
    } catch (err) {
      toast.error("Not removed", errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="min-w-0 rounded-lg border border-ops-line bg-ops-panel">
      <h2 className="border-b border-ops-line px-4 py-3 font-medium">Indexed documents</h2>
      <div className="p-4">
        {docs.error ? (
          <ErrorState dark title="Couldn't load documents" error={docs.error} onRetry={docs.reload} />
        ) : docs.loading ? (
          <Skeleton className="h-64 w-full text-ops-text" />
        ) : docs.data.length === 0 ? (
          <EmptyState dark title="No documents" message="Upload a policy, or run npm run kb:ingest to load the built-in ones." />
        ) : (
          <ul className="divide-y divide-ops-line text-sm">
            {docs.data.map((d) => (
              <li key={d.documentId} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{d.title}</p>
                  <p className="mt-0.5 font-mono text-xs text-ops-muted">
                    {label(d.docType)} · v{d.version} · effective {d.effectiveDate} · {d.region} ·{" "}
                    {d.tiers.length === 1 && d.tiers[0] === "ALL" ? "all members" : d.tiers.map(label).join(", ")} · {d.chunks} sections
                  </p>
                </div>
                {confirming === d.documentId ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ops-muted">Remove from answers?</span>
                    <Button variant="opsDanger" size="sm" loading={deleting} onClick={() => remove(d.documentId)}>Remove</Button>
                    <Button variant="opsOutline" size="sm" disabled={deleting} onClick={() => setConfirming(null)}>Keep</Button>
                  </div>
                ) : (
                  <Button variant="opsOutline" size="sm" aria-label={`Remove ${d.title}`} onClick={() => setConfirming(d.documentId)}>Remove</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
