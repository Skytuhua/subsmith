import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Film,
  X,
  Upload,
} from "lucide-react";
import type { Cue } from "../core/types";
import { formatSrt } from "../core/time";
import { stripTags } from "../core/transforms/text";
import { IconButton } from "./ui";

/** Find the cue active at time `ms` (first match if cues overlap). */
function activeIndexAt(cues: Cue[], ms: number): number {
  for (let i = 0; i < cues.length; i += 1) {
    if (ms >= cues[i].start && ms < cues[i].end) return i;
  }
  return -1;
}

export function PreviewPlayer({
  cues,
  spanMs,
  onActiveCueChange,
  onClose,
}: {
  cues: Cue[];
  spanMs: number;
  onActiveCueChange: (cueId: string | null) => void;
  onClose: () => void;
}) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTs = useRef<number>(0);
  const max = Math.max(spanMs, 1000);

  const activeIdx = useMemo(() => activeIndexAt(cues, time), [cues, time]);
  const activeCue = activeIdx >= 0 ? cues[activeIdx] : null;
  const overlayText = activeCue
    ? stripTags({ format: "srt", cues: [activeCue] }).cues[0].text
    : "";

  // Report the active cue id upward for table highlighting.
  useEffect(() => {
    onActiveCueChange(activeCue ? activeCue.id : null);
  }, [activeCue, onActiveCueChange]);

  // Virtual playback via rAF when no video is loaded.
  useEffect(() => {
    if (!playing || videoUrl) return;
    const tick = (ts: number) => {
      if (lastTs.current) {
        setTime((t) => {
          const next = t + (ts - lastTs.current);
          if (next >= max) {
            setPlaying(false);
            return max;
          }
          return next;
        });
      }
      lastTs.current = ts;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTs.current = 0;
    };
  }, [playing, videoUrl, max]);

  // Clean up any object URL on unmount / change.
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const loadVideo = useCallback((file: File) => {
    setVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setTime(0);
    setPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (videoUrl && videoRef.current) {
      if (videoRef.current.paused) void videoRef.current.play();
      else videoRef.current.pause();
    } else {
      setPlaying((p) => !p);
    }
  }, [videoUrl]);

  const seek = useCallback(
    (ms: number) => {
      const clamped = Math.max(0, Math.min(ms, max));
      setTime(clamped);
      if (videoRef.current) videoRef.current.currentTime = clamped / 1000;
    },
    [max],
  );

  const jumpCue = useCallback(
    (dir: 1 | -1) => {
      if (cues.length === 0) return;
      const idx = activeIndexAt(cues, time);
      let target: Cue | undefined;
      if (dir === 1) target = cues.find((c) => c.start > time);
      else
        target = [...cues]
          .reverse()
          .find((c) => c.start < (idx >= 0 ? cues[idx].start : time));
      if (target) seek(target.start);
    },
    [cues, time, seek],
  );

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <Film className="h-4 w-4 text-accent" aria-hidden />
          Preview
        </span>
        <IconButton label="Close preview" onClick={onClose} className="h-7 w-7">
          <X className="h-4 w-4" aria-hidden />
        </IconButton>
      </div>

      {/* Stage */}
      <div className="relative flex min-h-[10rem] flex-1 items-end justify-center overflow-hidden bg-black p-4">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="absolute inset-0 h-full w-full object-contain"
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime * 1000)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            playsInline
          />
        ) : (
          <LoadVideoPrompt onPick={loadVideo} />
        )}
        {overlayText && (
          <p className="relative z-10 max-w-[90%] whitespace-pre-line rounded bg-black/70 px-3 py-1.5 text-center text-sm font-medium text-white shadow-lg sm:text-base">
            {overlayText}
          </p>
        )}
      </div>

      {/* Transport */}
      <div className="space-y-2 border-t border-white/[0.06] px-3 py-2.5">
        <input
          type="range"
          aria-label="Scrub timeline"
          min={0}
          max={max}
          value={Math.round(time)}
          onChange={(e) => seek(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-[var(--color-accent)]"
        />
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs tabular-nums text-muted-fg">
            {formatSrt(Math.round(time))}
          </span>
          <div className="flex items-center gap-1">
            <IconButton
              label="Previous cue"
              onClick={() => jumpCue(-1)}
              className="h-8 w-8"
            >
              <SkipBack className="h-4 w-4" aria-hidden />
            </IconButton>
            <IconButton
              label={playing ? "Pause" : "Play"}
              onClick={togglePlay}
              variant="secondary"
              className="h-9 w-9"
            >
              {playing ? (
                <Pause className="h-4 w-4" aria-hidden />
              ) : (
                <Play className="h-4 w-4" aria-hidden />
              )}
            </IconButton>
            <IconButton
              label="Next cue"
              onClick={() => jumpCue(1)}
              className="h-8 w-8"
            >
              <SkipForward className="h-4 w-4" aria-hidden />
            </IconButton>
          </div>
          <span className="font-mono text-xs tabular-nums text-muted-fg">
            {formatSrt(max)}
          </span>
        </div>
        {videoUrl && (
          <button
            type="button"
            onClick={() => {
              setVideoUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return null;
              });
              setPlaying(false);
            }}
            className="w-full cursor-pointer rounded-sm py-1 text-xs text-muted-fg transition-colors hover:text-foreground"
          >
            Remove video
          </button>
        )}
      </div>
    </div>
  );
}

function LoadVideoPrompt({ onPick }: { onPick: (file: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      onClick={() => ref.current?.click()}
      className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-2 text-muted-fg transition-colors hover:text-foreground"
    >
      <Upload className="h-6 w-6" aria-hidden />
      <span className="text-sm">Load a local video to check sync</span>
      <span className="text-xs text-muted-fg/60">
        Or just press play to scrub the timeline
      </span>
      <input
        ref={ref}
        type="file"
        accept="video/*"
        aria-label="Load a local video file"
        tabIndex={-1}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </button>
  );
}
