import { useEffect, useMemo, useRef, useState } from "react";
import {
  Clock,
  Wand2,
  Film,
  Gauge,
  Search,
  Eraser,
  Combine,
  ListChecks,
  ArrowRight,
} from "lucide-react";
import type { CuePredicate } from "../core/transforms/common";
import { shift } from "../core/transforms/shift";
import { computeLinear, applyLinear } from "../core/transforms/linear";
import { FPS_PRESETS, applyFramerate } from "../core/transforms/framerate";
import { applyScale } from "../core/transforms/scale";
import {
  findReplace,
  stripTags,
  trimWhitespace,
  removeEmpty,
  sortByTime,
  fixMojibakeAll,
} from "../core/transforms/text";
import { merge } from "../core/transforms/merge";
import { parse } from "../core/parsers";
import { detectAndDecode } from "../core/detect";
import {
  lint,
  summarize,
  fixOverlaps,
  fixNegativeDurations,
  fixOrder,
  fixEmpty,
  type LintFinding,
} from "../core/lint";
import { formatSrt, parseTimecode } from "../core/time";
import type { Subtitle } from "../core/types";
import type { EditorApi } from "../state/useEditor";
import { readFileBytes } from "../lib/file";
import { useToast } from "./toast-context";
import { Button, Field, Panel, TextInput, Select, Badge } from "./ui";
import { Dropzone } from "./Dropzone";
import { cn } from "../lib/cn";

export function OperationsPanel({
  editor,
  onJumpTo,
}: {
  editor: EditorApi;
  onJumpTo: (index: number) => void;
}) {
  const hasSelection = editor.selectedIds.size > 0;
  const [scoped, setScoped] = useState(false);
  // Derive the effective scope so we never need to reset state from an effect.
  const effectiveScoped = scoped && hasSelection;

  const predicate: CuePredicate | undefined = useMemo(
    () => (effectiveScoped ? (c) => editor.selectedIds.has(c.id) : undefined),
    [effectiveScoped, editor.selectedIds],
  );
  const scopeLabel = predicate
    ? `${editor.selectedIds.size} selected`
    : "all cues";

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-card px-3.5 py-2.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-fg">
          Apply to
        </span>
        <label
          className={cn(
            "flex items-center gap-2 text-sm",
            !hasSelection && "opacity-50",
          )}
        >
          <input
            type="checkbox"
            checked={effectiveScoped}
            disabled={!hasSelection}
            onChange={(e) => setScoped(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-[var(--color-accent)] disabled:cursor-not-allowed"
          />
          <span className="text-foreground">{scopeLabel}</span>
        </label>
      </div>

      <ShiftPanel editor={editor} predicate={predicate} />
      <SyncPanel editor={editor} predicate={predicate} />
      <FrameratePanel editor={editor} predicate={predicate} />
      <ScalePanel editor={editor} predicate={predicate} />
      <FindReplacePanel editor={editor} predicate={predicate} />
      <CleanupPanel editor={editor} predicate={predicate} />
      <MergePanel editor={editor} />
      <LintPanel editor={editor} onJumpTo={onJumpTo} />
    </div>
  );
}

interface PanelProps {
  editor: EditorApi;
  predicate?: CuePredicate;
}

function ShiftPanel({ editor, predicate }: PanelProps) {
  const { notify } = useToast();
  const [seconds, setSeconds] = useState("0");

  const doShift = (ms: number) => {
    if (ms === 0) return;
    editor.apply(
      (d) => shift(d, ms, predicate),
      `Shift by ${(ms / 1000).toFixed(3)}s`,
    );
    notify(
      `Shifted ${scopeCount(editor, predicate)} by ${ms > 0 ? "+" : ""}${(ms / 1000).toFixed(3)}s`,
    );
  };

  return (
    <Panel
      title="Shift timing"
      icon={<Clock className="h-4 w-4" />}
      defaultOpen
    >
      <div className="flex flex-wrap gap-1.5">
        {[-1000, -500, -100, 100, 500, 1000].map((ms) => (
          <Button key={ms} size="sm" onClick={() => doShift(ms)}>
            {ms > 0 ? "+" : ""}
            {ms / 1000}s
          </Button>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <Field label="Offset (seconds)" htmlFor="shift-offset">
          <TextInput
            id="shift-offset"
            type="number"
            step="0.1"
            value={seconds}
            onChange={(e) => setSeconds(e.target.value)}
            placeholder="-2.5"
          />
        </Field>
        <Button
          variant="primary"
          onClick={() => {
            const v = parseFloat(seconds);
            if (Number.isFinite(v)) doShift(Math.round(v * 1000));
          }}
        >
          Apply
        </Button>
      </div>
      <p className="text-xs text-muted-fg/70">
        Negative moves subtitles earlier, positive moves them later.
      </p>
    </Panel>
  );
}

function SyncPanel({ editor, predicate }: PanelProps) {
  const { notify } = useToast();
  const doc = editor.state.doc!;
  // Anchor on the first/last cue of the scoped set (selection when scoped, else the whole doc).
  const scopedCues = predicate
    ? doc.cues.filter((c, i) => predicate(c, i))
    : doc.cues;
  const anchorSet = scopedCues.length >= 2 ? scopedCues : doc.cues;
  const first = anchorSet[0];
  const last = anchorSet[anchorSet.length - 1];
  const [new1, setNew1] = useState("");
  const [new2, setNew2] = useState("");

  const apply = () => {
    if (!first || !last) return;
    const o1 = first.start;
    const o2 = last.start;
    const n1 = new1.trim() === "" ? o1 : parseTimecode(new1);
    const n2 = new2.trim() === "" ? o2 : parseTimecode(new2);
    if (n1 === null || n2 === null) {
      notify("Enter valid timecodes for the anchor lines.", "error");
      return;
    }
    const t = computeLinear(o1, n1, o2, n2);
    if (!t) {
      notify(
        "The two anchor lines must have different original times.",
        "error",
      );
      return;
    }
    if (t.a <= 0) {
      notify(
        "Those corrected times are reversed — they'd run the subtitles backwards. Check the values.",
        "error",
      );
      return;
    }
    editor.apply((d) => applyLinear(d, t, predicate), "Two-point sync");
    notify(
      `Synced ${scopeCount(editor, predicate)} (speed ×${t.a.toFixed(4)})`,
    );
    setNew1("");
    setNew2("");
  };

  return (
    <Panel title="Two-point sync" icon={<Wand2 className="h-4 w-4" />}>
      <p className="text-xs text-muted-fg/80">
        Fixes constant offset <em>and</em> progressive drift. Type where the
        first and last lines <em>should</em> appear.
      </p>
      <AnchorRow
        label="First line"
        current={first ? formatSrt(first.start) : "—"}
        value={new1}
        onChange={setNew1}
      />
      <AnchorRow
        label="Last line"
        current={last ? formatSrt(last.start) : "—"}
        value={new2}
        onChange={setNew2}
      />
      <Button variant="primary" className="w-full" onClick={apply}>
        Apply sync
      </Button>
    </Panel>
  );
}

function AnchorRow({
  label,
  current,
  value,
  onChange,
}: {
  label: string;
  current: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-background/40 p-2.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-fg">
        {label}
      </span>
      <div className="mt-1.5 flex items-center gap-2">
        <span
          className="w-full rounded-sm bg-background/40 px-2 py-1 text-center font-mono text-xs text-muted-fg"
          title="Current time"
        >
          {current}
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-fg" aria-hidden />
        <input
          aria-label={`${label} correct time`}
          value={value}
          placeholder={current}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-sm border border-border bg-background/60 px-2 py-1 text-center font-mono text-xs text-foreground focus:border-accent"
        />
      </div>
    </div>
  );
}

function FrameratePanel({ editor, predicate }: PanelProps) {
  const { notify } = useToast();
  const [preset, setPreset] = useState("0");
  const [from, setFrom] = useState("23.976");
  const [to, setTo] = useState("25");

  const applyPreset = () => {
    const p = FPS_PRESETS[Number(preset)];
    editor.apply(
      (d) => applyFramerate(d, p.from, p.to, predicate),
      `FPS ${p.from}→${p.to}`,
    );
    notify(
      `Converted ${scopeCount(editor, predicate)}: ${p.from} → ${p.to} fps`,
    );
  };
  const applyCustom = () => {
    const f = parseFloat(from);
    const t = parseFloat(to);
    if (!(f > 0) || !(t > 0)) {
      notify("Enter valid positive frame rates.", "error");
      return;
    }
    editor.apply((d) => applyFramerate(d, f, t, predicate), `FPS ${f}→${t}`);
    notify(`Converted ${scopeCount(editor, predicate)}: ${f} → ${t} fps`);
  };

  return (
    <Panel title="Frame-rate conversion" icon={<Film className="h-4 w-4" />}>
      <Field label="Preset">
        <div className="flex gap-2">
          <Select value={preset} onChange={(e) => setPreset(e.target.value)}>
            {FPS_PRESETS.map((p, i) => (
              <option key={p.label} value={i}>
                {p.label}
              </option>
            ))}
          </Select>
          <Button variant="primary" onClick={applyPreset}>
            Apply
          </Button>
        </div>
      </Field>
      <div className="flex items-end gap-2">
        <Field label="From fps">
          <TextInput
            type="number"
            step="0.001"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="To fps">
          <TextInput
            type="number"
            step="0.001"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <Button onClick={applyCustom}>Apply</Button>
      </div>
    </Panel>
  );
}

function ScalePanel({ editor, predicate }: PanelProps) {
  const { notify } = useToast();
  const [percent, setPercent] = useState("100");
  const apply = () => {
    const v = parseFloat(percent);
    if (!(v > 0)) {
      notify("Enter a positive percentage.", "error");
      return;
    }
    editor.apply((d) => applyScale(d, v, predicate), `Scale ${v}%`);
    notify(`Scaled ${scopeCount(editor, predicate)} to ${v}%`);
  };
  return (
    <Panel title="Scale by percentage" icon={<Gauge className="h-4 w-4" />}>
      <div className="flex items-end gap-2">
        <Field label="Percentage" hint="101% = 1% longer/slower; 99% = faster.">
          <TextInput
            type="number"
            step="0.1"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
          />
        </Field>
        <Button variant="primary" onClick={apply}>
          Apply
        </Button>
      </div>
    </Panel>
  );
}

function FindReplacePanel({ editor, predicate }: PanelProps) {
  const { notify } = useToast();
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [regex, setRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [busy, setBusy] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  // Terminate any in-flight worker if the panel unmounts.
  useEffect(() => () => workerRef.current?.terminate(), []);

  const commit = (res: { subtitle: Subtitle; count: number; error?: string }) => {
    if (res.error) {
      notify(`Invalid regular expression: ${res.error}`, "error");
      return;
    }
    if (res.count === 0) {
      notify("No matches found.", "info");
      return;
    }
    editor.setDoc(res.subtitle, `Replace "${find}"`);
    notify(`Replaced ${res.count} occurrence${res.count === 1 ? "" : "s"}.`);
  };

  const run = () => {
    if (find === "" || busy) return;
    const doc = editor.state.doc;
    if (!doc) return;

    // Literal replace is linear-time and safe — run it inline against the live document.
    if (!regex) {
      commit(findReplace(doc, find, replace, { regex: false, caseSensitive, predicate }));
      return;
    }

    // A user-supplied regex can backtrack catastrophically, so run it in a Web Worker and
    // abandon it after a timeout rather than freezing the tab.
    setBusy(true);
    const worker = new Worker(
      new URL("../workers/replace.worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;
    const timer = window.setTimeout(() => {
      worker.terminate();
      workerRef.current = null;
      setBusy(false);
      notify(
        "That pattern is too slow (it may be backtracking catastrophically). Simplify it.",
        "error",
      );
    }, 3000);
    worker.onmessage = (ev: MessageEvent) => {
      window.clearTimeout(timer);
      worker.terminate();
      workerRef.current = null;
      setBusy(false);
      commit(ev.data);
    };
    worker.onerror = () => {
      window.clearTimeout(timer);
      worker.terminate();
      workerRef.current = null;
      setBusy(false);
      notify("Find & replace failed.", "error");
    };
    worker.postMessage({
      doc,
      find,
      replace,
      caseSensitive,
      selectionIds: predicate ? [...editor.selectedIds] : null,
    });
  };

  return (
    <Panel title="Find & replace" icon={<Search className="h-4 w-4" />}>
      <Field label="Find">
        <TextInput
          value={find}
          onChange={(e) => setFind(e.target.value)}
          placeholder="text or pattern"
        />
      </Field>
      <Field label="Replace with">
        <TextInput
          value={replace}
          onChange={(e) => setReplace(e.target.value)}
          placeholder="replacement"
        />
      </Field>
      <div className="flex flex-wrap gap-4">
        <Checkbox checked={regex} onChange={setRegex} label="Regex" />
        <Checkbox
          checked={caseSensitive}
          onChange={setCaseSensitive}
          label="Match case"
        />
      </div>
      <Button
        variant="primary"
        className="w-full"
        onClick={run}
        disabled={find === "" || busy}
      >
        {busy ? "Working…" : "Replace all"}
      </Button>
    </Panel>
  );
}

function CleanupPanel({ editor, predicate }: PanelProps) {
  const { notify } = useToast();
  const act = (fn: (d: Subtitle) => Subtitle, label: string, msg: string) => {
    editor.apply(fn, label);
    notify(msg);
  };
  return (
    <Panel title="Clean up" icon={<Eraser className="h-4 w-4" />}>
      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          onClick={() =>
            act(
              (d) => stripTags(d, predicate),
              "Strip tags",
              "Removed formatting tags.",
            )
          }
        >
          Strip tags
        </Button>
        <Button
          size="sm"
          onClick={() =>
            act(
              (d) => trimWhitespace(d, predicate),
              "Trim whitespace",
              "Trimmed whitespace.",
            )
          }
        >
          Trim spaces
        </Button>
        <Button
          size="sm"
          onClick={() =>
            act(
              (d) => fixMojibakeAll(d, predicate),
              "Fix encoding",
              "Repaired garbled characters.",
            )
          }
        >
          Fix mojibake
        </Button>
        <Button
          size="sm"
          onClick={() =>
            act(
              (d) => sortByTime(d),
              "Sort by time",
              "Sorted cues by start time.",
            )
          }
        >
          Sort by time
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="col-span-2"
          onClick={() =>
            act((d) => removeEmpty(d), "Remove empty", "Removed empty cues.")
          }
        >
          Remove empty cues
        </Button>
      </div>
    </Panel>
  );
}

function MergePanel({ editor }: { editor: EditorApi }) {
  const { notify } = useToast();
  const [addition, setAddition] = useState<{
    name: string;
    sub: Subtitle;
  } | null>(null);
  const [offset, setOffset] = useState("0");

  const onFiles = async (files: File[]) => {
    const file = files[0];
    try {
      const bytes = await readFileBytes(file);
      const decoded = detectAndDecode(bytes);
      const { subtitle } = parse(decoded.text, undefined, file.name);
      setAddition({ name: file.name, sub: subtitle });
    } catch {
      notify("Could not read that file.", "error");
    }
  };

  const doMerge = () => {
    if (!addition) return;
    const ms = Math.round((parseFloat(offset) || 0) * 1000);
    editor.setDoc(merge(editor.state.doc!, addition.sub, ms), "Merge file");
    notify(`Merged ${addition.sub.cues.length} cues from ${addition.name}.`);
    setAddition(null);
    setOffset("0");
  };

  return (
    <Panel title="Merge another file" icon={<Combine className="h-4 w-4" />}>
      <Dropzone onFiles={onFiles}>
        {({ open }) => (
          <button
            type="button"
            onClick={open}
            className="w-full cursor-pointer rounded-md border border-dashed border-border/70 bg-background/40 px-3 py-3 text-sm text-muted-fg transition-colors hover:border-accent/60 hover:text-foreground"
          >
            {addition
              ? `Loaded: ${addition.name} (${addition.sub.cues.length} cues)`
              : "Choose a second subtitle to append…"}
          </button>
        )}
      </Dropzone>
      {addition && (
        <div className="flex items-end gap-2">
          <Field
            label="Offset (seconds)"
            hint="Added to the second file's times."
          >
            <TextInput
              type="number"
              step="0.1"
              value={offset}
              onChange={(e) => setOffset(e.target.value)}
            />
          </Field>
          <Button variant="primary" onClick={doMerge}>
            Merge
          </Button>
        </div>
      )}
    </Panel>
  );
}

function LintPanel({
  editor,
  onJumpTo,
}: {
  editor: EditorApi;
  onJumpTo: (index: number) => void;
}) {
  const { notify } = useToast();
  const doc = editor.state.doc!;
  const findings = useMemo(() => lint(doc), [doc]);
  const summary = summarize(findings);

  const fix = (fn: (d: Subtitle) => Subtitle, label: string, msg: string) => {
    editor.apply(fn, label);
    notify(msg);
  };

  const badge =
    summary.total === 0 ? (
      <Badge tone="accent">clean</Badge>
    ) : (
      <Badge tone={summary.errors > 0 ? "destructive" : "warning"}>
        {summary.total}
      </Badge>
    );

  return (
    <Panel
      title="Validate"
      icon={<ListChecks className="h-4 w-4" />}
      badge={badge}
    >
      {summary.total === 0 ? (
        <p className="text-sm text-accent">No timing or text issues found.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            {summary.errors > 0 && (
              <Badge tone="destructive">{summary.errors} errors</Badge>
            )}
            {summary.warnings > 0 && (
              <Badge tone="warning">{summary.warnings} warnings</Badge>
            )}
            {summary.infos > 0 && (
              <Badge tone="muted">{summary.infos} notes</Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              onClick={() =>
                fix((d) => fixOverlaps(d), "Fix overlaps", "Resolved overlaps.")
              }
            >
              Fix overlaps
            </Button>
            <Button
              size="sm"
              onClick={() =>
                fix((d) => fixOrder(d), "Sort by time", "Reordered cues.")
              }
            >
              Fix order
            </Button>
            <Button
              size="sm"
              onClick={() =>
                fix(
                  (d) => fixNegativeDurations(d),
                  "Fix durations",
                  "Fixed bad durations.",
                )
              }
            >
              Fix durations
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() =>
                fix((d) => fixEmpty(d), "Remove empty", "Removed empty cues.")
              }
            >
              Drop empties
            </Button>
          </div>
          <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {findings.slice(0, 200).map((f, i) => (
              <FindingRow
                key={i}
                finding={f}
                onClick={() => {
                  editor.setSelection([f.cueId], f.cueIndex);
                  onJumpTo(f.cueIndex);
                }}
              />
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function FindingRow({
  finding,
  onClick,
}: {
  finding: LintFinding;
  onClick: () => void;
}) {
  const tone =
    finding.severity === "error"
      ? "text-destructive"
      : finding.severity === "warning"
        ? "text-warning"
        : "text-muted-fg";
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full cursor-pointer items-start gap-2 rounded-sm px-2 py-1 text-left text-xs transition-colors hover:bg-white/[0.04]"
      >
        <span
          className={cn(
            "mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full",
            tone.replace("text", "bg"),
          )}
          aria-hidden
        />
        <span className="text-foreground/90">{finding.message}</span>
      </button>
    </li>
  );
}

// ---- helpers ----

function scopeCount(editor: EditorApi, predicate?: CuePredicate): string {
  const n = predicate
    ? editor.selectedIds.size
    : (editor.state.doc?.cues.length ?? 0);
  return `${n} cue${n === 1 ? "" : "s"}`;
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
      />
      {label}
    </label>
  );
}
