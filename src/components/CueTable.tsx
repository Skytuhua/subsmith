import { memo, useCallback, useRef, useState } from "react";
import { Scissors, Trash2, Copy, Plus } from "lucide-react";
import type { Cue, Subtitle } from "../core/types";
import { formatSrt, parseTimecode } from "../core/time";
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
  const display = draft ?? formatSrt(valueMs);

  const commit = () => {
    if (draft === null) return;
    const ms = parseTimecode(draft);
    if (ms !== null) onCommit(ms);
    setDraft(null);
  };

  return (
    <input
      aria-label={ariaLabel}
      inputMode="numeric"
      value={display}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
      className={cn(
        "w-[7.5rem] rounded-sm border bg-background/40 px-1.5 py-1 text-center font-mono text-xs tabular-nums text-foreground",
        "transition-colors duration-150 focus:border-accent",
        invalid
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

  return (
    <div
      className={cn(
        "cv-row group grid grid-cols-[2.5rem_1fr] gap-x-3 border-b border-white/[0.04] px-2 py-2 sm:grid-cols-[2.5rem_auto_1fr_auto]",
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
          "min-h-[1.9rem] w-full resize-none rounded-sm border border-transparent bg-transparent px-2 py-1 text-sm leading-snug text-foreground",
          "transition-colors duration-150 hover:border-border/60 focus:border-accent focus:bg-background/40",
        )}
      />

      {/* Row actions. */}
      <div className="col-start-2 flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 sm:col-start-4">
        <IconButton
          label="Duplicate cue"
          onClick={() => onDuplicate(index)}
          className="h-7 w-7"
        >
          <Copy className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
        <IconButton
          label="Split cue"
          onClick={() => onSplit(index)}
          className="h-7 w-7"
        >
          <Scissors className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
        <IconButton
          label="Delete cue"
          onClick={() => onDelete(cue.id)}
          variant="destructive"
          className="h-7 w-7"
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
}: {
  editor: EditorApi;
  activeCueId: string | null;
}) {
  const doc = editor.state.doc!;
  const { selectedIds, setSelection } = editor;
  const lastClick = useRef<number | null>(null);

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
        const [a, b] = [lastClick.current, index].sort((x, y) => x - y);
        setSelection(
          cues.slice(a, b + 1).map((c) => c.id),
          index,
        );
      } else if (e.metaKey || e.ctrlKey) {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelection([...next], index);
        lastClick.current = index;
      } else {
        setSelection([id], index);
        lastClick.current = index;
      }
    },
    [editor, selectedIds, setSelection],
  );

  const splitCue = useCallback(
    (index: number) => {
      editor.apply((d) => splitCueAt(d, index), "Split cue");
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
      editor.apply((d) => {
        const cues = [...d.cues];
        const src = cues[index];
        cues.splice(index + 1, 0, {
          ...src,
          id: `dup-${src.id}-${Date.now().toString(36)}`,
        });
        return { ...d, cues };
      }, "Duplicate cue");
    },
    [editor],
  );

  const addCue = useCallback(() => {
    editor.apply((d) => {
      const last = d.cues[d.cues.length - 1];
      const start = last ? last.end + 100 : 0;
      const newCue: Cue = {
        id: `new-${Date.now().toString(36)}`,
        start,
        end: start + 2000,
        text: "",
      };
      return { ...d, cues: [...d.cues, newCue] };
    }, "Add cue");
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

      <div className="min-h-0 flex-1 overflow-y-auto">
        {doc.cues.length === 0 ? (
          <EmptyDoc onAdd={addCue} />
        ) : (
          doc.cues.map((cue, i) => (
            <CueRow
              key={cue.id}
              cue={cue}
              index={i}
              selected={selectedIds.has(cue.id)}
              active={activeCueId === cue.id}
              onSelect={handleSelect}
              onPatch={patch}
              onSplit={splitCue}
              onDelete={deleteCue}
              onDuplicate={duplicateCue}
            />
          ))
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
  const b: Cue = {
    ...src,
    id: `split-${src.id}-${Date.now().toString(36)}`,
    start: mid,
    text: textB,
  };
  cues.splice(index, 1, a, b);
  return { ...doc, cues };
}
