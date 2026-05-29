import { useEffect, useRef, useState } from "react";
import {
  Undo2,
  Redo2,
  Download,
  FolderOpen,
  Eye,
  ChevronDown,
} from "lucide-react";
import type { EditorApi } from "../state/useEditor";
import type { SubtitleFormat } from "../core/types";
import { serialize, FORMAT_LABEL } from "../core/serializers";
import { ENCODINGS } from "../core/detect";
import { downloadText, withExtension } from "../lib/download";
import { useToast } from "./toast-context";
import { Button, IconButton, Badge, Select } from "./ui";
import { Dropzone } from "./Dropzone";
import { Wordmark } from "./Wordmark";
import { cn } from "../lib/cn";

export function Header({
  editor,
  onFiles,
  onTogglePreview,
  previewOpen,
}: {
  editor: EditorApi;
  onFiles: (files: File[]) => void;
  onTogglePreview: () => void;
  previewOpen: boolean;
}) {
  const { state } = editor;
  const fmt = state.doc?.format ?? "srt";

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/[0.06] bg-card/60 px-3 py-2 backdrop-blur">
      <Wordmark />

      <div className="flex min-w-0 items-center gap-2">
        <span
          className="max-w-[12rem] truncate text-sm text-muted-fg"
          title={state.fileName ?? undefined}
        >
          {state.fileName ?? "untitled"}
        </span>
        <Badge tone="muted">{fmt.toUpperCase()}</Badge>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {state.rawBytes && (
          <label className="hidden items-center gap-1.5 md:flex">
            <span className="text-xs text-muted-fg">Encoding</span>
            <div className="w-40">
              <Select
                value={
                  ENCODINGS.some((e) => e.value === state.encoding)
                    ? state.encoding
                    : "utf-8"
                }
                onChange={(e) => editor.redecode(e.target.value)}
                aria-label="Re-decode with encoding"
              >
                {ENCODINGS.map((enc) => (
                  <option key={enc.value} value={enc.value}>
                    {enc.label}
                  </option>
                ))}
              </Select>
            </div>
          </label>
        )}

        <div className="mx-1 hidden h-6 w-px bg-border/50 sm:block" />

        <IconButton
          label="Undo"
          onClick={editor.undo}
          disabled={!editor.canUndo}
        >
          <Undo2 className="h-4 w-4" aria-hidden />
        </IconButton>
        <IconButton
          label="Redo"
          onClick={editor.redo}
          disabled={!editor.canRedo}
        >
          <Redo2 className="h-4 w-4" aria-hidden />
        </IconButton>

        <IconButton
          label={previewOpen ? "Hide preview" : "Show preview"}
          onClick={onTogglePreview}
          className={cn(previewOpen && "text-accent")}
        >
          <Eye className="h-4 w-4" aria-hidden />
        </IconButton>

        <Dropzone onFiles={onFiles}>
          {({ open }) => (
            <IconButton label="Open another file" onClick={open}>
              <FolderOpen className="h-4 w-4" aria-hidden />
            </IconButton>
          )}
        </Dropzone>

        <ExportMenu editor={editor} />
      </div>
    </header>
  );
}

function ExportMenu({ editor }: { editor: EditorApi }) {
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [bom, setBom] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const format = editor.state.exportFormat;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const doDownload = () => {
    const doc = editor.state.doc;
    if (!doc) return;
    const text = serialize(doc, format, { bom });
    downloadText(withExtension(editor.state.fileName, format), text);
    notify(`Exported ${doc.cues.length} cues as ${format.toUpperCase()}.`);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="primary"
        icon={<Download className="h-4 w-4" aria-hidden />}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        Export
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </Button>
      {open && (
        <div
          role="dialog"
          aria-label="Export options"
          className="absolute right-0 z-20 mt-2 w-64 space-y-3 rounded-lg border border-white/[0.08] bg-card p-3.5 shadow-xl animate-fade-in"
        >
          <div className="space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-fg">
              Format
            </span>
            <Select
              value={format}
              onChange={(e) =>
                editor.setExportFormat(e.target.value as SubtitleFormat)
              }
              aria-label="Export format"
            >
              {(["srt", "vtt", "ass"] as SubtitleFormat[]).map((f) => (
                <option key={f} value={f}>
                  {FORMAT_LABEL[f]}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={bom}
              onChange={(e) => setBom(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
            />
            Add UTF-8 BOM
          </label>
          <Button
            variant="primary"
            className="w-full"
            onClick={doDownload}
            icon={<Download className="h-4 w-4" aria-hidden />}
          >
            Download .{format}
          </Button>
        </div>
      )}
    </div>
  );
}
