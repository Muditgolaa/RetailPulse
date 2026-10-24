const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export const formatPrice = (value) => inr.format(Number(value));

// Indian short form for large amounts: ₹4.23 Cr, ₹12.5 L.
export function formatPriceShort(value) {
  const n = Number(value);
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
  return formatPrice(n);
}

export const formatNumber = (value, digits = 0) =>
  Number(value).toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });

// Shared stock rules (same as the backend seed): available <= reorder point means low stock.
export function stockStatus(available, reorderPoint) {
  if (available <= 0) return "OUT_OF_STOCK";
  if (available <= reorderPoint) return "LOW_STOCK";
  return "IN_STOCK";
}

export const capitalize = (s) => s.charAt(0) + s.slice(1).toLowerCase();
