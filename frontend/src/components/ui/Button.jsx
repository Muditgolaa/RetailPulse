const variants = {
  primary: "bg-forest text-ivory hover:bg-forest-deep disabled:bg-ink-soft/40",
  outline: "border border-ink/20 text-ink hover:border-ink/50 hover:bg-ivory-deep disabled:text-ink-soft/50",
  ghost: "text-ink-soft hover:text-ink hover:bg-ivory-deep",
  opsPrimary: "bg-ops-emerald text-ops-bg hover:bg-ops-lime disabled:bg-ops-line disabled:text-ops-muted",
  opsOutline: "border border-ops-line text-ops-text hover:border-ops-muted hover:bg-ops-raised disabled:text-ops-muted",
  opsDanger: "border border-ops-red/40 text-ops-red hover:bg-ops-red/10 disabled:text-ops-muted disabled:border-ops-line",
};

const sizes = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export default function Button({ variant = "primary", size = "md", loading = false, className = "", children, disabled, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
      {children}
    </button>
  );
}
