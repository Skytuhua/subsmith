import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Scissors, Trash2, Copy, Plus } from "lucide-react";
import type { Cue, Subtitle } from "../core/types";
import { formatSrt, parseTimecode } from "../core/time";
import { nextId } from "../core/id";
import { readingSpeedCps } from "../core/reading";
import { DEFAULT_THRESHOLDS } from "../core/lint";
import type { EditorApi } from "../state/useEditor";
import { cn } from "../lib/cn";
import { IconButton } from "./ui";

/** A timecode field with local edit state that commits on blur / Enter. */
function TimeInput({
  valueMs,
  onCommit,
  invalid,
  ariaLabel,
}: {
  valueMs: number;
  onCommit: (ms: number) => void;
  invalid?: boolean;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [parseError, setParseError] = useState(false);
  const display = draft ?? formatSrt(valueMs);
  // `invalid` flags a negative duration (cross-field); `parseError` flags an unparseable
  // value just typed into THIS field. Either should read as invalid to AT and the eye.
  const showInvalid = invalid || parseError;

  const commit = () => {
    if (draft === null) return;
    const ms = parseTimecode(draft);
    if (ms === null) {
      // Keep an unparseable draft visible (flagged) instead of silently reverting it, so
      // the user can see and correct their typo. An empty field just reverts.
      if (draft.trim() !== "") {
        setParseError(true);
        return;
      }
      setDraft(null);
      return;
    }
    onCommit(ms);
    setDraft(null);
    setParseError(false);
  };

  return (
    <input
      aria-label={ariaLabel}
      aria-invalid={showInvalid || undefined}
      title={parseError ? "Use hh:mm:ss,mmm (or .mmm) format" : undefined}
      inputMode="numeric"
      value={display}
      onChange={(e) => {
        setDraft(e.target.value);
        setParseError(false);
      }}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setDraft(null);
          setParseError(false);
          e.currentTarget.blur();
        }
      }}
      className={cn(
        "w-[7.5rem] rounded-sm border bg-background/40 px-1.5 py-1 text-center font-mono text-xs tabular-nums text-foreground",
        "transition-colors duration-150 focus:border-accent",
        showInvalid
          ? "border-destructive text-destructive"
          : "border-transparent hover:border-border",
      )}
    />
  );
}

interface RowProps {
  cue: Cue;
  index: number;
  selected: boolean;
  active: boolean;
  onSelect: (index: number, e: React.MouseEvent) => void;
  onPatch: (id: string, patch: Partial<Cue>, label: string) => void;
  onSplit: (index: number) => void;
  onDelete: (id: string) => void;
  onDuplicate: (index: number) => void;
}

const CueRow = memo(function CueRow({
  cue,
  index,
  selected,
  active,
  onSelect,
  onPatch,
  onSplit,
  onDelete,
  onDuplicate,
}: RowProps) {
  const [text, setText] = useState<string | null>(null);
  const duration = cue.end - cue.start;
  const negative = duration <= 0;
  // Reading speed (chars/sec) — surfaces the same metric the lint "fast-reading" rule uses,
  // inline per cue, for the readability-conscious (fansubbers, translators, learners).
  const cps = negative ? 0 : readingSpeedCps(cue.text, duration);
  const fast = cps > DEFAULT_THRESHOLDS.maxCps;

  return (
    <div
      className={cn(
        "group grid grid-cols-[2.5rem_1fr] gap-x-3 border-b border-white/[0.04] px-2 py-2 sm:grid-cols-[2.5rem_auto_1fr_auto]",
        "transition-colors duration-100",
        selected ? "bg-accent/[0.07]" : "hover:bg-white/[0.02]",
        active && "ring-1 ring-inset ring-accent/50",
      )}
    >
      {/* Index — click to select. */}
      <button
        type="button"
        onClick={(e) => onSelect(index, e)}
        className={cn(
          "flex h-7 cursor-pointer items-start justify-center pt-0.5 font-mono text-xs tabular-nums",
          selected ? "text-accent" : "text-muted-fg hover:text-foreground",
        )}
        aria-label={`Select cue ${index + 1}`}
        aria-pressed={selected}
      >
        {index + 1}
      </button>

      {/* Times + duration. */}
      <div className="flex flex-wrap items-center gap-1.5 sm:flex-col sm:items-start">
        <div className="flex items-center gap-1">
          <TimeInput
            ariaLabel={`Cue ${index + 1} start`}
            valueMs={cue.start}
            invalid={negative}
            onCommit={(ms) => onPatch(cue.id, { start: ms }, "Edit start time")}
          />
          <span className="text-muted-fg" aria-hidden>
            →
          </span>
          <TimeInput
            ariaLabel={`Cue ${index + 1} end`}
            valueMs={cue.end}
            invalid={negative}
            onCommit={(ms) => onPatch(cue.id, { end: ms }, "Edit end time")}
          />
        </div>
        <span
          className={cn(
            "px-1 font-mono text-[11px] tabular-nums",
            negative ? "text-destructive" : "text-muted-fg/70",
          )}
        >
          {negative ? "invalid" : `${(duration / 1000).toFixed(2)}s`}
        </span>
        {cps > 0 && (
          <span
            className={cn(
              "px-1 font-mono text-[11px] tabular-nums",
              fast ? "text-warning" : "text-muted-fg/40",
            )}
            title={`${Math.round(cps)} characters/second${fast ? " — reads fast" : ""}`}
          >
            {Math.round(cps)} cps
          </span>
        )}
      </div>

      {/* Text. */}
      <textarea
        aria-label={`Cue ${index + 1} text`}
        value={text ?? cue.text}
        rows={Math.max(1, (text ?? cue.text).split("\n").length)}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text !== null && text !== cue.text)
            onPatch(cue.id, { text }, "Edit text");
          setText(null);
        }}
        className={cn(
          // On mobile the grid is 2 cols, so span both to avoid being squeezed into the
          // index column; on sm+ it's the dedicated text column.
          "col-span-2 col-start-1 sm:col-span-1 sm:col-start-3",
          "min-h-[1.9rem] w-full resize-none rounded-sm border border-transparent bg-transparent px-2 py-1 text-sm leading-snug text-foreground",
          "transition-colors duration-150 hover:border-border/60 focus:border-accent focus:bg-background/40",
        )}
      />

      {/* Row actions. Always visible on touch (mobile), hover/focus-reveal on sm+ pointers —
          otherwise touch users had no way to duplicate/split/delete a single cue. */}
      <div className="col-start-2 flex items-center gap-0.5 opacity-100 sm:col-start-4 sm:opacity-0 sm:transition-opacity sm:focus-within:opacity-100 sm:group-hover:opacity-100">
        <IconButton label="Duplicate cue" onClick={() => onDuplicate(index)}>
          <Copy className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
        <IconButton label="Split cue" onClick={() => onSplit(index)}>
          <Scissors className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
        <IconButton
          label="Delete cue"
          onClick={() => onDelete(cue.id)}
          variant="destructive"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
      </div>
    </div>
  );
});

export function CueTable({
  editor,
  activeCueId,
  jumpIndex,
  jumpNonce,
}: {
  editor: EditorApi;
  activeCueId: string | null;
  jumpIndex?: number | null;
  jumpNonce?: number;
}) {
  const doc = editor.state.doc!;
  const { selectedIds, setSelection } = editor;
  // Anchor the shift-click range on a cue *id*, not an array index, so it stays correct
  // after cues are reordered, deleted, merged, or undone.
  const lastClick = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Virtualize the cue list so files with thousands of cues stay smooth: only the rows
  // near the viewport are mounted, and heights are measured dynamically (multi-line cues).
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual's stable API is used per its docs
  const virtualizer = useVirtualizer({
    count: doc.cues.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 64,
    overscan: 12,
    getItemKey: (i) => doc.cues[i].id,
  });

  // Scroll to a cue when a lint finding is clicked. Intentionally fires only when jumpNonce
  // changes (each click is a fresh jump request, even to the same index): jumpIndex is a
  // prop so the closure always reads its current value, EditorView sets index+nonce together
  // (EditorView.tsx), and virtualizer is a stable ref — so omitting them is safe, not stale.
  useEffect(() => {
    if (jumpIndex == null) return;
    virtualizer.scrollToIndex(jumpIndex, { align: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nonce is the deliberate trigger (see above)
  }, [jumpNonce]);

  const patch = useCallback(
    (id: string, p: Partial<Cue>, label: string) => {
      editor.apply(
        (d) => ({
          ...d,
          cues: d.cues.map((c) => (c.id === id ? { ...c, ...p } : c)),
        }),
        label,
      );
    },
    [editor],
  );

  const handleSelect = useCallback(
    (index: number, e: React.MouseEvent) => {
      const cues = editor.state.doc!.cues;
      const id = cues[index].id;
      if (e.shiftKey && lastClick.current !== null) {
        // Resolve the anchor id to its *current* index; fall back to this click if the
        // anchored cue has since been removed.
        const anchor = cues.findIndex((c) => c.id === lastClick.current);
        const from = anchor === -1 ? index : anchor;
        const [a, b] = [from, index].sort((x, y) => x - y);
        setSelection(
          cues.slice(a, b + 1).map((c) => c.id),
          index,
        );
      } else if (e.metaKey || e.ctrlKey) {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelection([...next], index);
        lastClick.current = id;
      } else {
        setSelection([id], index);
        lastClick.current = id;
      }
    },
    [editor, selectedIds, setSelection],
  );

  // Operations that mint new cue ids are computed in the handler (not inside the reducer)
  // so the reducer stays pure — ids are generated exactly once, never during a StrictMode
  // double-invoke.
  const splitCue = useCallback(
    (index: number) => {
      const d = editor.state.doc;
      if (!d) return;
      editor.setDoc(splitCueAt(d, index), "Split cue");
    },
    [editor],
  );

  const deleteCue = useCallback(
    (id: string) => {
      editor.apply(
        (d) => ({ ...d, cues: d.cues.filter((c) => c.id !== id) }),
        "Delete cue",
      );
    },
    [editor],
  );

  const duplicateCue = useCallback(
    (index: number) => {
      const d = editor.state.doc;
      if (!d) return;
      const cues = [...d.cues];
      cues.splice(index + 1, 0, { ...cues[index], id: nextId() });
      editor.setDoc({ ...d, cues }, "Duplicate cue");
    },
    [editor],
  );

  const addCue = useCallback(() => {
    const d = editor.state.doc;
    if (!d) return;
    const last = d.cues[d.cues.length - 1];
    const start = last ? last.end + 100 : 0;
    const newCue: Cue = { id: nextId(), start, end: start + 2000, text: "" };
    editor.setDoc({ ...d, cues: [...d.cues, newCue] }, "Add cue");
  }, [editor]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <div className="grid grid-cols-[2.5rem_auto_1fr] gap-x-3 text-[11px] font-medium uppercase tracking-wide text-muted-fg max-sm:hidden">
          <span className="text-center">#</span>
          <span>Timing</span>
          <span className="pl-2">Text</span>
        </div>
        <button
          type="button"
          onClick={addCue}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add cue
        </button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {doc.cues.length === 0 ? (
          <EmptyDoc onAdd={addCue} />
        ) : (
          <div
            style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}
          >
            {virtualizer.getVirtualItems().map((vi) => {
              const cue = doc.cues[vi.index];
              return (
                <div
                  key={cue.id}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${vi.start}px)`,
                  }}
                >
                  <CueRow
                    cue={cue}
                    index={vi.index}
                    selected={selectedIds.has(cue.id)}
                    active={activeCueId === cue.id}
                    onSelect={handleSelect}
                    onPatch={patch}
                    onSplit={splitCue}
                    onDelete={deleteCue}
                    onDuplicate={duplicateCue}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyDoc({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
      <p className="text-sm text-muted-fg">This file has no cues.</p>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary/80"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Add the first cue
      </button>
    </div>
  );
}

/** Split a cue at its temporal midpoint, dividing the text by lines where possible. */
function splitCueAt(doc: Subtitle, index: number): Subtitle {
  const cues = [...doc.cues];
  const src = cues[index];
  const mid = Math.floor((src.start + src.end) / 2);
  const lines = src.text.split("\n");
  let textA: string;
  let textB: string;
  if (lines.length > 1) {
    const half = Math.ceil(lines.length / 2);
    textA = lines.slice(0, half).join("\n");
    textB = lines.slice(half).join("\n");
  } else {
    const words = src.text.split(" ");
    const half = Math.ceil(words.length / 2);
    textA = words.slice(0, half).join(" ");
    textB = words.slice(half).join(" ");
  }
  const a: Cue = { ...src, end: mid, text: textA };
  const b: Cue = { ...src, id: nextId(), start: mid, text: textB };
  cues.splice(index, 1, a, b);
  return { ...doc, cues };
}
