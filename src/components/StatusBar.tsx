import { Hash, Clock, MousePointerClick, FileCode2 } from "lucide-react";
import type { EditorApi } from "../state/useEditor";
import { docStats } from "../lib/stats";
import { ENCODINGS } from "../core/detect";

export function StatusBar({ editor }: { editor: EditorApi }) {
  const { state } = editor;
  const stats = docStats(state.doc);
  const totalSec = (stats.totalDurationMs / 1000).toFixed(1);
  const encLabel =
    ENCODINGS.find((e) => e.value === state.encoding)?.label ?? state.encoding;

  return (
    <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/[0.06] bg-card/60 px-3 py-1.5 text-xs text-muted-fg">
      <Item
        icon={<Hash className="h-3.5 w-3.5" />}
        label={`${stats.count} cues`}
      />
      <Item
        icon={<Clock className="h-3.5 w-3.5" />}
        label={`${totalSec}s shown · ends ${stats.spanLabel}`}
      />
      {editor.selectedIds.size > 0 && (
        <Item
          icon={<MousePointerClick className="h-3.5 w-3.5" />}
          label={`${editor.selectedIds.size} selected`}
          accent
        />
      )}
      <span className="ml-auto inline-flex items-center gap-1.5">
        <FileCode2 className="h-3.5 w-3.5" aria-hidden />
        <span className="font-mono">{encLabel}</span>
      </span>
      {state.lastOp && (
        <span className="text-muted-fg/60">· {state.lastOp}</span>
      )}
    </footer>
  );
}

function Item({
  icon,
  label,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  accent?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${accent ? "text-accent" : ""}`}
    >
      <span aria-hidden>{icon}</span>
      <span className="tabular-nums">{label}</span>
    </span>
  );
}
