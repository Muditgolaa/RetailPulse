type PaginationProps = { page: number; totalPages: number; onChange: (page: number) => void };

export default function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i);
  const base = "inline-flex size-9 items-center justify-center rounded-md text-sm tabular";

  return (
    <nav className="flex items-center justify-center gap-1" aria-label="Pagination">
      <button className={`${base} hover:bg-ivory-deep disabled:opacity-30`} onClick={() => onChange(page - 1)} disabled={page === 0} aria-label="Previous page">
        ←
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          aria-current={p === page ? "page" : undefined}
          className={`${base} ${p === page ? "bg-ink text-ivory" : "hover:bg-ivory-deep"}`}
        >
          {p + 1}
        </button>
      ))}
      <button className={`${base} hover:bg-ivory-deep disabled:opacity-30`} onClick={() => onChange(page + 1)} disabled={page >= totalPages - 1} aria-label="Next page">
        →
      </button>
    </nav>
  );
}
