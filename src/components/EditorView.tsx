import { useMemo, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { EditorApi } from "../state/useEditor";
import { docStats } from "../lib/stats";
import { Header } from "./Header";
import { CueTable } from "./CueTable";
import { OperationsPanel } from "./OperationsPanel";
import { PreviewPlayer } from "./PreviewPlayer";
import { StatusBar } from "./StatusBar";
import { Dropzone } from "./Dropzone";
import { cn } from "../lib/cn";

export function EditorView({
  editor,
  onFiles,
}: {
  editor: EditorApi;
  onFiles: (files: File[]) => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeCueId, setActiveCueId] = useState<string | null>(null);
  const [warningsDismissed, setWarningsDismissed] = useState(false);
  const [jump, setJump] = useState<{ index: number; nonce: number }>({
    index: -1,
    nonce: 0,
  });
  const doc = editor.state.doc!;
  const span = useMemo(() => docStats(doc).spanMs, [doc]);

  const togglePreview = () => {
    setPreviewOpen((o) => {
      if (o) setActiveCueId(null);
      return !o;
    });
  };

  const warnings = editor.state.warnings;

  return (
    <div className="flex h-screen flex-col">
      <Header
        editor={editor}
        onFiles={onFiles}
        onTogglePreview={togglePreview}
        previewOpen={previewOpen}
      />

      {warnings.length > 0 && !warningsDismissed && (
        <div className="flex items-start gap-2 border-b border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="flex-1">
            <span className="font-medium">
              Parsed with {warnings.length} warning
              {warnings.length === 1 ? "" : "s"}.
            </span>{" "}
            <span className="text-warning/80">{warnings[0].message}</span>
          </div>
          <button
            type="button"
            aria-label="Dismiss warnings"
            onClick={() => setWarningsDismissed(true)}
            className="cursor-pointer rounded-sm p-0.5 hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <Dropzone onFiles={onFiles} className="flex min-h-0 flex-1 flex-col">
          {({ dragging }) => (
            <main
              className={cn(
                "relative flex min-h-0 flex-1 flex-col",
                dragging &&
                  "outline-2 -outline-offset-2 outline-dashed outline-accent",
              )}
            >
              <CueTable
                editor={editor}
                activeCueId={activeCueId}
                jumpIndex={jump.index}
                jumpNonce={jump.nonce}
              />
              {dragging && (
                <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-background/70 text-sm font-medium text-accent">
                  Drop to open this file
                </div>
              )}
            </main>
          )}
        </Dropzone>

        <aside className="flex min-h-0 flex-1 flex-col border-t border-white/[0.06] lg:w-[384px] lg:flex-none lg:border-l lg:border-t-0">
          {previewOpen && (
            <div className="h-72 shrink-0 border-b border-white/[0.06]">
              <PreviewPlayer
                cues={doc.cues}
                spanMs={span}
                onActiveCueChange={setActiveCueId}
                onClose={togglePreview}
              />
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <OperationsPanel
              editor={editor}
              onJumpTo={(index) => setJump({ index, nonce: Date.now() })}
            />
          </div>
        </aside>
      </div>

      <StatusBar editor={editor} />
    </div>
  );
}
