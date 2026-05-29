import { useCallback, useState, type ReactNode } from "react";
import { CheckCircle2, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "../lib/cn";
import { ToastContext, type ToastTone } from "./toast-context";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = nextId++;
      setToasts((t) => [...t, { id, message, tone }]);
      window.setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-[min(92vw,30rem)] -translate-x-1/2 flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastRow key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastRow({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const Icon =
    toast.tone === "success"
      ? CheckCircle2
      : toast.tone === "error"
        ? AlertTriangle
        : Info;
  const tone =
    toast.tone === "success"
      ? "text-accent"
      : toast.tone === "error"
        ? "text-destructive"
        : "text-muted-fg";
  return (
    <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-white/[0.08] bg-card px-4 py-3 shadow-lg animate-slide-up">
      <Icon className={cn("h-5 w-5 shrink-0", tone)} aria-hidden />
      <p className="flex-1 text-sm text-foreground">{toast.message}</p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onClose}
        className="cursor-pointer rounded-sm p-0.5 text-muted-fg transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
