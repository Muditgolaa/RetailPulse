// Neutral pulse block; uses the current text colour so it works on ivory and dark slate.
export default function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-md bg-current opacity-[0.08] ${className}`} aria-hidden />;
}
