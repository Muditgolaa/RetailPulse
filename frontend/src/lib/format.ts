const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export const formatPrice = (value: number) => inr.format(value);

// Indian short form for large amounts: ₹4.23 Cr, ₹12.5 L.
export function formatPriceShort(value: number) {
  if (value >= 1e7) return `₹${(value / 1e7).toFixed(2)} Cr`;
  if (value >= 1e5) return `₹${(value / 1e5).toFixed(1)} L`;
  return formatPrice(value);
}

export const formatNumber = (value: number, digits = 0) =>
  value.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });

// "GOLD" → "Gold", "READY_FOR_PICKUP" → "Ready for pickup"
export const capitalize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
