export function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-display text-[1.75rem] font-extrabold leading-none tracking-tight text-ink ${className}`}
    >
      losupe
      <span className="text-accent" aria-hidden="true">
        .
      </span>
    </span>
  );
}
