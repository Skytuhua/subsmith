/** The Subsmith wordmark: an SVG caption mark plus the product name. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <a
        href="/"
        className="flex items-center gap-2"
        aria-label="Subsmith home"
      >
        <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden role="img">
          <rect width="32" height="32" rx="7" fill="#1B2336" />
          <rect
            x="5"
            y="9"
            width="22"
            height="14"
            rx="3"
            fill="#0F172A"
            stroke="#475569"
            strokeWidth="1"
          />
          <rect x="8" y="17" width="9" height="2.5" rx="1.25" fill="#22C55E" />
          <rect x="19" y="17" width="5" height="2.5" rx="1.25" fill="#94A3B8" />
          <rect
            x="8"
            y="12.5"
            width="13"
            height="2.5"
            rx="1.25"
            fill="#334155"
          />
        </svg>
        <span className="text-base font-bold tracking-tight text-foreground">
          Sub<span className="text-accent">smith</span>
        </span>
      </a>
    </span>
  );
}
