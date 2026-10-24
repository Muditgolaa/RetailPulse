import { MAX_QTY } from "../../store/cart";

type QtyStepperProps = { value: number; onChange: (qty: number) => void; label?: string };

export default function QtyStepper({ value, onChange, label = "Quantity" }: QtyStepperProps) {
  const btn = "inline-flex size-9 items-center justify-center text-lg hover:bg-ivory-deep disabled:opacity-30";
  return (
    <div className="inline-flex items-center rounded-md border border-line bg-white" role="group" aria-label={label}>
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Decrease quantity">
        −
      </button>
      <span className="tabular w-8 text-center text-sm" aria-live="polite">{value}</span>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= MAX_QTY} aria-label="Increase quantity">
        +
      </button>
    </div>
  );
}
