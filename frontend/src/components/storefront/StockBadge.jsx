const styles = {
  IN_STOCK: "bg-forest-soft text-forest",
  LOW_STOCK: "bg-amber-soft text-amber",
  OUT_OF_STOCK: "bg-danger-soft text-danger",
};

export function stockLabel({ status, available }) {
  if (status === "OUT_OF_STOCK") return "Out of stock";
  if (status === "LOW_STOCK") return `Only ${available} left`;
  return "In stock";
}

export default function StockBadge({ availability, className = "" }) {
  if (!availability) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[availability.status]} ${className}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {stockLabel(availability)}
    </span>
  );
}
