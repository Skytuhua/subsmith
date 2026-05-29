import { Upload, ShieldCheck, Clock, Wand2, FileText } from "lucide-react";
import { Dropzone } from "./Dropzone";
import { Button } from "./ui";
import { cn } from "../lib/cn";

const FEATURES = [
  {
    icon: Clock,
    title: "Fix the timing",
    body: "Shift, two-point sync, and frame-rate conversion to kill constant offset and progressive drift.",
  },
  {
    icon: Wand2,
    title: "Clean it up",
    body: "Repair garbled encoding, strip tags, find & replace, merge split files, and lint for overlaps.",
  },
  {
    icon: ShieldCheck,
    title: "Stays on your device",
    body: "Everything runs in your browser. Your files are never uploaded to any server.",
  },
];

/** Inline GitHub mark (lucide dropped brand icons; SVG keeps it crisp and dependency-free). */
function GithubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
      role="img"
    >
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.07 11.07 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.69 5.41-5.26 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
    </svg>
  );
}

export function Landing({
  onFiles,
  onDemo,
}: {
  onFiles: (files: File[]) => void;
  onDemo: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 py-16 text-center">
        <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-card px-3 py-1 text-xs font-medium text-muted-fg">
          <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden />
          100% in-browser · nothing uploaded
        </span>

        <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Fix out-of-sync subtitles,
          <br className="hidden sm:block" /> right in your browser.
        </h1>
        <p className="mt-4 max-w-xl text-pretty text-base text-muted-fg sm:text-lg">
          Subsmith is a privacy-first workbench for{" "}
          <span className="text-foreground">SRT</span>,{" "}
          <span className="text-foreground">VTT</span>, and{" "}
          <span className="text-foreground">ASS</span> subtitles. Shift timing,
          correct drift, repair encoding, merge, lint, and convert — without
          uploading a thing.
        </p>

        <Dropzone onFiles={onFiles} className="mt-9 w-full">
          {({ dragging, open }) => (
            <div
              role="button"
              tabIndex={0}
              onClick={open}
              onKeyDown={(e) =>
                (e.key === "Enter" || e.key === " ") &&
                (e.preventDefault(), open())
              }
              className={cn(
                "group flex w-full cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-12 transition-colors duration-150",
                dragging
                  ? "border-accent bg-accent/[0.06]"
                  : "border-border/70 bg-card hover:border-accent/60 hover:bg-white/[0.02]",
              )}
            >
              <span
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-full transition-colors duration-150",
                  dragging
                    ? "bg-accent text-accent-fg"
                    : "bg-muted text-accent group-hover:bg-accent/15",
                )}
              >
                <Upload className="h-6 w-6" aria-hidden />
              </span>
              <span className="text-base font-medium text-foreground">
                Drop a subtitle file here, or{" "}
                <span className="text-accent">browse</span>
              </span>
              <span className="text-sm text-muted-fg">
                .srt · .vtt · .ass / .ssa — up to a few MB
              </span>
            </div>
          )}
        </Dropzone>

        <div className="mt-4">
          <Button
            variant="ghost"
            size="sm"
            icon={<FileText className="h-4 w-4" aria-hidden />}
            onClick={onDemo}
          >
            Try a demo file
          </Button>
        </div>

        <ul className="mt-12 grid w-full gap-4 text-left sm:grid-cols-3">
          {FEATURES.map((f) => (
            <li
              key={f.title}
              className="rounded-lg border border-white/[0.06] bg-card p-4"
            >
              <f.icon className="h-5 w-5 text-accent" aria-hidden />
              <h2 className="mt-3 text-sm font-semibold text-foreground">
                {f.title}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-fg">
                {f.body}
              </p>
            </li>
          ))}
        </ul>
      </main>

      <footer className="border-t border-white/[0.06] px-5 py-5">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-3 text-xs text-muted-fg sm:flex-row">
          <p>
            Built for people who just want their subtitles to line up. No
            accounts, no tracking.
          </p>
          <a
            href="https://github.com/Skytuhua/subsmith"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-sm text-muted-fg transition-colors hover:text-foreground"
          >
            <GithubMark className="h-4 w-4" />
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
