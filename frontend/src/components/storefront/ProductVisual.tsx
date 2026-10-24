// Drawn product artwork per category (the catalogue has no photos yet). Line drawings on a tinted plate.
// Each category has three close plate tints; the SKU picks one so neighbouring cards don't look identical.
import type { SVGProps } from "react";
import type { ProductSummary } from "../../types";

const looks: Record<string, { bg: string[]; ink: string }> = {
  Laptops: { bg: ["#e6e1d4", "#dfe1d8", "#e9e4da"], ink: "#2b3a33" },
  Mobiles: { bg: ["#dfe6df", "#e4e8de", "#d9e3dc"], ink: "#1f4d3a" },
  Appliances: { bg: ["#ece4d6", "#e8e2d8", "#efe6d3"], ink: "#4a3f2e" },
  "TV & Audio": { bg: ["#e2e2dc", "#e6e3da", "#dde0db"], ink: "#24282a" },
  Accessories: { bg: ["#e9e3dc", "#ebe5d9", "#e4e0da"], ink: "#3d3530" },
};
const tintFor = (sku = "") => [...sku].reduce((n, c) => n + c.charCodeAt(0), 0) % 3;

function Drawing({ category, ink }: { category: string; ink: string }) {
  const s: SVGProps<SVGGElement> = { fill: "none", stroke: ink, strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (category) {
    case "Laptops":
      return (
        <g {...s}>
          <rect x="34" y="30" width="92" height="58" rx="4" />
          <rect x="41" y="37" width="78" height="44" rx="1.5" opacity=".35" />
          <path d="M22 96h116l-8 8H30z" />
        </g>
      );
    case "Mobiles":
      return (
        <g {...s}>
          <rect x="58" y="18" width="44" height="88" rx="8" />
          <path d="M74 25h12" />
          <rect x="63" y="32" width="34" height="62" rx="2" opacity=".35" />
        </g>
      );
    case "Appliances":
      return (
        <g {...s}>
          <rect x="52" y="14" width="56" height="94" rx="5" />
          <path d="M52 48h56M98 26v12M98 60v16" />
        </g>
      );
    case "TV & Audio":
      return (
        <g {...s}>
          <rect x="24" y="22" width="112" height="66" rx="3" />
          <path d="M66 104h28M80 88v16" />
          <path d="M40 74c10-14 22-14 32 0" opacity=".35" />
        </g>
      );
    default:
      return (
        <g {...s}>
          <path d="M60 30c0-10 40-10 40 0v56c0 14-40 14-40 0z" />
          <path d="M80 26v20" />
          <circle cx="80" cy="78" r="5" opacity=".35" />
        </g>
      );
  }
}

type ProductVisualProps = { product: Pick<ProductSummary, "sku" | "brand" | "category">; className?: string };

export default function ProductVisual({ product, className = "" }: ProductVisualProps) {
  const look = looks[product.category] ?? looks.Accessories;
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ backgroundColor: look.bg[tintFor(product.sku)] }}>
      <svg viewBox="0 0 160 120" className="absolute inset-0 m-auto h-3/5 w-3/5" role="img" aria-label={`${product.category} illustration`}>
        <Drawing category={product.category} ink={look.ink} />
      </svg>
      <span className="absolute bottom-3 left-3 font-display text-xs tracking-wide" style={{ color: look.ink }}>
        {product.brand}
      </span>
    </div>
  );
}
