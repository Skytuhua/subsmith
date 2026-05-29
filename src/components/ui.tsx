import {
  forwardRef,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-fg hover:brightness-110 shadow-[0_0_18px_-6px_var(--color-accent)] disabled:shadow-none",
  secondary:
    "bg-secondary text-foreground hover:bg-secondary/80 border border-border/60",
  ghost: "bg-transparent text-muted-fg hover:bg-muted hover:text-foreground",
  destructive:
    "bg-destructive/15 text-destructive hover:bg-destructive/25 border border-destructive/30",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "secondary", size = "md", icon, className, children, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex select-none items-center justify-center rounded-md font-medium",
          "cursor-pointer transition-[background-color,filter,transform,box-shadow] duration-150",
          "active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
          VARIANTS[variant],
          SIZES[size],
          className,
        )}
        {...props}
      >
        {icon}
        {children}
      </button>
    );
  },
);

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: Variant;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { label, variant = "ghost", className, children, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-md",
          "cursor-pointer transition-colors duration-150",
          "disabled:cursor-not-allowed disabled:opacity-40",
          VARIANTS[variant],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);

export const TextInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function TextInput({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-sm border border-border bg-background/60 px-2.5 text-sm text-foreground",
        "placeholder:text-muted-fg/60 transition-colors duration-150",
        "hover:border-border/80 focus:border-accent",
        className,
      )}
      {...props}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "h-9 w-full cursor-pointer appearance-none rounded-sm border border-border bg-background/60 pl-2.5 pr-8 text-sm text-foreground",
          "transition-colors duration-150 hover:border-border/80 focus:border-accent",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-fg"
        aria-hidden
      />
    </div>
  );
});

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-fg">
        {label}
      </span>
      {children}
      {hint && <span className="block text-xs text-muted-fg/70">{hint}</span>}
    </label>
  );
}

export function Badge({
  children,
  tone = "muted",
  className,
}: {
  children: ReactNode;
  tone?: "muted" | "accent" | "warning" | "destructive";
  className?: string;
}) {
  const tones: Record<string, string> = {
    muted: "bg-muted text-muted-fg",
    accent: "bg-accent/15 text-accent",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/15 text-destructive",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A collapsible operations panel (accordion section). */
export function Panel({
  title,
  icon,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className="overflow-hidden rounded-lg border border-white/[0.06] bg-card">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-3 text-left",
            "transition-colors duration-150 hover:bg-white/[0.03]",
          )}
        >
          <span className="text-accent">{icon}</span>
          <span className="flex-1 text-sm font-semibold text-foreground">
            {title}
          </span>
          {badge}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-fg transition-transform duration-200",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </h3>
      {open && (
        <div
          id={id}
          className="space-y-3 border-t border-white/[0.06] px-3.5 py-3.5"
        >
          {children}
        </div>
      )}
    </section>
  );
}
