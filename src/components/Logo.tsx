/** Marca de losupe.com: anillo con órbita y núcleo (señal / nodo de IA) + wordmark futurista. */
export function LogoMark({
  className = "h-7 w-7",
  id = "losupe-mark",
}: {
  className?: string;
  id?: string;
}) {
  const gid = `${id}-grad`;
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0B1F3A" />
          <stop offset="0.55" stopColor="#1D4ED8" />
          <stop offset="1" stopColor="#2EE6A6" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="12.5" stroke={`url(#${gid})`} strokeWidth="3" />
      <path
        d="M16 3.5 A12.5 12.5 0 0 1 28.5 16"
        stroke="#FFD60A"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="4.3" fill="#FFD60A" />
    </svg>
  );
}

export function Logo({
  className = "",
  size = "md",
  id = "losupe-mark",
}: {
  className?: string;
  size?: "md" | "lg";
  id?: string;
}) {
  const text = size === "lg" ? "text-[2.1rem]" : "text-[1.55rem]";
  const mark = size === "lg" ? "h-9 w-9" : "h-7 w-7";
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className={mark} id={id} />
      <span className={`font-brand ${text} font-bold leading-none tracking-[-0.045em]`}>
        <span className="bg-gradient-to-r from-ink via-[#1d4ed8] to-[#2ee6a6] bg-clip-text text-transparent">
          losupe
        </span>
        <span className="text-accent">.</span>
        <span className="text-[0.78em] font-semibold tracking-[-0.02em] text-ink/80">com</span>
      </span>
    </span>
  );
}
