import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { MIN_CUT_RANGE_SECONDS } from "@shared/app.config";
import { type ClipRecord, type CutRange, type ScaleTarget } from "@shared/ipc";
import {
  formatBytes,
  formatDuration,
  formatEstimateBytes,
  formatPixels,
  formatResolution,
  formatTimecode,
  parseTimecode,
  downscaleResolutions,
  estimateOutputBytes,
  resolutionKey,
} from "@/format";
import {
  ChevronDownIcon,
  ImageIcon,
  MonitorIcon,
  PauseIcon,
  PlayIcon,
  SaveIcon,
  ScissorsIcon,
  SplitIcon,
  Trash2Icon,
} from "lucide-react";

type KeepRange = CutRange & { id: string };

type DragState =
  | { kind: "playhead" }
  | { kind: "range"; id: string; edge: "start" | "end" }
  | null;

function newRangeId(): string {
  return crypto.randomUUID();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sortedRanges(ranges: KeepRange[]): KeepRange[] {
  return [...ranges].sort((a, b) => a.start - b.start);
}

function keepTotal(ranges: KeepRange[]): number {
  return ranges.reduce((sum, range) => sum + Math.max(0, range.end - range.start), 0);
}

function boundsFor(
  ranges: KeepRange[],
  id: string,
  duration: number,
): { minStart: number; maxEnd: number } {
  const sorted = sortedRanges(ranges);
  const index = sorted.findIndex((range) => range.id === id);
  const prev = index > 0 ? sorted[index - 1] : undefined;
  const next = index >= 0 && index < sorted.length - 1 ? sorted[index + 1] : undefined;
  return {
    minStart: prev?.end ?? 0,
    maxEnd: next?.start ?? duration,
  };
}

function applyRange(
  ranges: KeepRange[],
  id: string,
  start: number,
  end: number,
  duration: number,
): KeepRange[] {
  const { minStart, maxEnd } = boundsFor(ranges, id, duration);
  let nextStart = clamp(start, minStart, Math.max(minStart, maxEnd - MIN_CUT_RANGE_SECONDS));
  let nextEnd = clamp(end, nextStart + MIN_CUT_RANGE_SECONDS, maxEnd);
  if (nextEnd - nextStart < MIN_CUT_RANGE_SECONDS) return ranges;
  nextStart = clamp(nextStart, minStart, nextEnd - MIN_CUT_RANGE_SECONDS);
  return ranges.map((range) =>
    range.id === id ? { ...range, start: nextStart, end: nextEnd } : range,
  );
}

function splitRangeAt(
  ranges: KeepRange[],
  playhead: number,
): { ranges: KeepRange[]; selectedId: string } | { error: string } {
  const target = ranges.find(
    (range) => playhead > range.start && playhead < range.end,
  );
  if (!target) {
    return { error: "Die Abspielposition liegt in keinem Abschnitt." };
  }
  if (
    playhead - target.start < MIN_CUT_RANGE_SECONDS ||
    target.end - playhead < MIN_CUT_RANGE_SECONDS
  ) {
    return { error: "Zu nah am Rand, um den Abschnitt zu teilen." };
  }
  const left: KeepRange = { ...target, end: playhead };
  const right: KeepRange = { id: newRangeId(), start: playhead, end: target.end };
  return {
    ranges: ranges.flatMap((range) => (range.id === target.id ? [left, right] : range)),
    selectedId: right.id,
  };
}

function neighborId(ranges: KeepRange[], id: string): string | null {
  const sorted = sortedRanges(ranges);
  const index = sorted.findIndex((range) => range.id === id);
  if (index < 0) return sorted[0]?.id ?? null;
  return sorted[index + 1]?.id ?? sorted[index - 1]?.id ?? null;
}

function timeFromClientX(
  clientX: number,
  el: HTMLElement,
  duration: number,
): number {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0) return 0;
  return clamp(((clientX - rect.left) / rect.width) * duration, 0, duration);
}

const ORIGINAL_SCALE = "original";

function parseScaleKey(key: string): ScaleTarget | null {
  const match = /^(\d+)x(\d+)$/.exec(key);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isInteger(width) || !Number.isInteger(height)) return null;
  return { width, height };
}

function ResolutionChoice({
  title,
  pixels,
  bytes,
}: {
  title: string;
  pixels?: string;
  bytes?: number | null;
}) {
  return (
    <span className="flex w-full min-w-0 items-baseline justify-between gap-6">
      <span className="flex min-w-0 flex-col">
        <span>{title}</span>
        {pixels ? (
          <span className="text-xs font-normal text-muted-foreground">{pixels}</span>
        ) : null}
      </span>
      {bytes != null && bytes > 0 ? (
        <span className="shrink-0 text-xs font-normal tabular-nums text-muted-foreground">
          {formatEstimateBytes(bytes)}
        </span>
      ) : null}
    </span>
  );
}

interface TimeFieldProps {
  value: number;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
  onCommit: (seconds: number) => void;
}

function TimeField({ value, disabled, ariaLabel, className, onCommit }: TimeFieldProps) {
  const [text, setText] = useState(formatTimecode(value));

  useEffect(() => {
    setText(formatTimecode(value));
  }, [value]);

  function commit(): void {
    const parsed = parseTimecode(text);
    if (parsed == null) {
      setText(formatTimecode(value));
      return;
    }
    onCommit(parsed);
  }

  return (
    <Input
      value={text}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "h-7 w-19 px-1.5 text-center font-mono text-xs",
        className,
      )}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

interface ClipCutterProps {
  clip: ClipRecord;
  busy: boolean;
  active?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSave: (
    ranges: CutRange[],
    overwrite?: boolean,
    scale?: ScaleTarget | null,
    name?: string | null,
  ) => void;
  onExportGif?: (ranges: CutRange[]) => void;
}

export function ClipCutter({
  clip,
  busy,
  active = true,
  error,
  onCancel,
  onSave,
  onExportGif,
}: ClipCutterProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>(null);
  const scrubbingRef = useRef(false);
  const scrubRafRef = useRef<number | null>(null);
  const [duration, setDuration] = useState(clip.durationSeconds ?? 0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ranges, setRanges] = useState<KeepRange[]>(() => {
    const initial = clip.durationSeconds ?? 0;
    if (initial <= MIN_CUT_RANGE_SECONDS) return [];
    return [{ id: newRangeId(), start: 0, end: initial }];
  });
  const [selectedId, setSelectedId] = useState<string | null>(
    () => ranges[0]?.id ?? null,
  );
  const [gapHint, setGapHint] = useState<string | null>(null);
  const [saveMode, setSaveMode] = useState<"new" | "overwrite" | "gif" | null>(
    null,
  );
  const [sourceSize, setSourceSize] = useState<{
    width: number;
    height: number;
  } | null>(() =>
    clip.width && clip.height && clip.width > 0 && clip.height > 0
      ? { width: clip.width, height: clip.height }
      : null,
  );
  const [scaleKey, setScaleKey] = useState(ORIGINAL_SCALE);
  const [clipName, setClipName] = useState(clip.name);
  const currentTimeRef = useRef(0);
  const rangesRef = useRef(ranges);
  const selectedIdRef = useRef(selectedId);
  rangesRef.current = ranges;
  selectedIdRef.current = selectedId;
  currentTimeRef.current = currentTime;

  useEffect(() => {
    if (busy) return;
    const restore = saveMode === "overwrite";
    setSaveMode(null);
    if (!restore) return;
    const video = videoRef.current;
    if (!video || video.getAttribute("src") || !clip.mediaUrl) return;
    video.src = clip.mediaUrl;
    video.load();
  }, [busy, clip.mediaUrl]);

  useEffect(() => {
    setClipName(clip.name);
  }, [clip.name]);

  const selected = ranges.find((range) => range.id === selectedId) ?? null;
  const totalKeep = keepTotal(ranges);
  const downscales = downscaleResolutions(sourceSize?.width, sourceSize?.height);
  const scaleValid =
    scaleKey === ORIGINAL_SCALE ||
    downscales.some((item) => resolutionKey(item.width, item.height) === scaleKey);
  const activeScaleKey = scaleValid ? scaleKey : ORIGINAL_SCALE;
  function estimateFor(
    targetWidth?: number | null,
    targetHeight?: number | null,
  ): number | null {
    if (!sourceSize) return null;
    return estimateOutputBytes({
      fileSizeBytes: clip.fileSizeBytes,
      sourceDuration: duration,
      keepDuration: totalKeep,
      sourceWidth: sourceSize.width,
      sourceHeight: sourceSize.height,
      targetWidth,
      targetHeight,
      fps: clip.fps,
    });
  }
  const originalBytes = estimateFor();
  const canSave =
    !busy &&
    duration > 0 &&
    ranges.length > 0 &&
    totalKeep >= MIN_CUT_RANGE_SECONDS;

  useEffect(() => {
    if (!active) {
      videoRef.current?.pause();
      return;
    }
    function onKey(e: KeyboardEvent): void {
      if (document.querySelector('[data-slot="dialog-content"]')) return;
      if (document.querySelector('[data-slot="dropdown-menu-content"]')) return;
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (typing) return;
      if (e.key === "Escape" && !busy) {
        onCancel();
        return;
      }
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        void togglePlay();
        return;
      }
      if (
        (e.key === "s" || e.key === "S") &&
        !busy &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        applySplit(currentTimeRef.current);
        return;
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !busy &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        removeSelected();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, busy, onCancel]);

  useEffect(() => {
    function onMove(e: PointerEvent): void {
      const drag = dragRef.current;
      const track = trackRef.current;
      if (!drag || !track || duration <= 0) return;
      const time = timeFromClientX(e.clientX, track, duration);
      scrubTo(time);
      if (drag.kind === "range") {
        setRanges((prev) => {
          const range = prev.find((item) => item.id === drag.id);
          if (!range) return prev;
          if (drag.edge === "start") {
            return applyRange(prev, drag.id, time, range.end, duration);
          }
          return applyRange(prev, drag.id, range.start, time, duration);
        });
      }
    }
    function finishScrub(): void {
      if (!dragRef.current) return;
      dragRef.current = null;
      const video = videoRef.current;
      if (video) {
        video.currentTime = currentTimeRef.current;
        const done = (): void => {
          scrubbingRef.current = false;
        };
        video.addEventListener("seeked", done, { once: true });
        window.setTimeout(done, 400);
      } else {
        scrubbingRef.current = false;
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finishScrub);
    window.addEventListener("pointercancel", finishScrub);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finishScrub);
      window.removeEventListener("pointercancel", finishScrub);
    };
  }, [duration]);

  function scrubTo(time: number): void {
    const next = clamp(time, 0, duration || 0);
    currentTimeRef.current = next;
    setCurrentTime(next);
    if (scrubRafRef.current != null) return;
    scrubRafRef.current = window.requestAnimationFrame(() => {
      scrubRafRef.current = null;
      const video = videoRef.current;
      if (video) video.currentTime = currentTimeRef.current;
    });
  }

  async function togglePlay(): Promise<void> {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) {
      video.pause();
      return;
    }
    const target = currentTimeRef.current;
    if (Math.abs(video.currentTime - target) > 0.05) {
      scrubbingRef.current = true;
      video.currentTime = target;
      await new Promise<void>((resolve) => {
        const done = (): void => {
          video.removeEventListener("seeked", done);
          resolve();
        };
        video.addEventListener("seeked", done);
        window.setTimeout(done, 500);
      });
      scrubbingRef.current = false;
      if (Math.abs(video.currentTime - target) > 0.25) {
        video.currentTime = target;
      }
    }
    try {
      await video.play();
    } catch {
      // Play can abort if a seek is still in flight.
    }
  }

  function onMeta(): void {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const next = video.duration;
    setDuration(next);
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      setSourceSize({ width: video.videoWidth, height: video.videoHeight });
    }
    setRanges((prev) => {
      if (prev.length > 0) {
        return prev.map((range) => ({
          ...range,
          start: clamp(range.start, 0, next),
          end: clamp(range.end, 0, next),
        }));
      }
      const full: KeepRange = { id: newRangeId(), start: 0, end: next };
      setSelectedId(full.id);
      return [full];
    });
  }

  function startDrag(state: DragState, event: ReactPointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    scrubbingRef.current = true;
    dragRef.current = state;
    if (state?.kind === "playhead") {
      videoRef.current?.pause();
    }
    if (state?.kind === "range") setSelectedId(state.id);
  }

  function applySplit(playhead: number): void {
    const result = splitRangeAt(rangesRef.current, playhead);
    if ("error" in result) {
      setGapHint(result.error);
      return;
    }
    setGapHint(null);
    setRanges(result.ranges);
    setSelectedId(result.selectedId);
  }

  function removeSelected(): void {
    const id = selectedIdRef.current;
    if (!id) {
      setGapHint("Klicke zuerst einen Abschnitt an.");
      return;
    }
    const current = rangesRef.current;
    if (current.length <= 1) {
      setGapHint("Teile zuerst mit S, dann lösche den ungewollten Abschnitt.");
      return;
    }
    const next = current.filter((range) => range.id !== id);
    setGapHint(null);
    setRanges(next);
    setSelectedId(neighborId(current, id));
  }

  function releaseVideo(): void {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.removeAttribute("src");
    video.load();
  }

  function save(overwrite: boolean): void {
    const next = sortedRanges(ranges).map(({ start, end }) => ({ start, end }));
    setSaveMode(overwrite ? "overwrite" : "new");
    if (overwrite) releaseVideo();
    const trimmed = clipName.trim();
    const nextName = trimmed && trimmed !== clip.name ? trimmed : null;
    onSave(next, overwrite, parseScaleKey(scaleKey), nextName);
  }

  function exportGif(): void {
    if (!onExportGif) return;
    const next = sortedRanges(ranges).map(({ start, end }) => ({ start, end }));
    setSaveMode("gif");
    onExportGif(next);
  }

  const canExportGif = canSave && Boolean(onExportGif);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-transparent">
      <div className="border-b border-white/10 bg-card/55 px-4 py-3 backdrop-blur-xl">
        <Input
          value={clipName}
          disabled={busy}
          aria-label="Clip-Name"
          title="Name des gespeicherten Clips"
          placeholder="Clip-Name"
          className="h-8"
          onChange={(e) => setClipName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      </div>

      <div className="relative min-h-0 flex-1 p-4 pb-0">
        <div className="relative h-full overflow-hidden rounded-lg bg-background ring-1 ring-white/10">
          <video
            ref={videoRef}
            src={clip.mediaUrl ?? undefined}
            preload="auto"
            className="absolute inset-0 h-full w-full object-contain bg-background"
            onLoadedMetadata={onMeta}
            onTimeUpdate={() => {
              if (scrubbingRef.current) return;
              const video = videoRef.current;
              if (video) setCurrentTime(video.currentTime);
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        </div>
      </div>

      <div className="shrink-0 px-4 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={togglePlay}
            disabled={duration <= 0}
          >
            {playing ? (
              <PauseIcon data-icon="inline-start" />
            ) : (
              <PlayIcon data-icon="inline-start" />
            )}
            {playing ? "Pause" : "Abspielen"}
          </Button>
          <p className="font-mono text-xs text-muted-foreground">
            {formatTimecode(currentTime)} / {formatTimecode(duration)}
          </p>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="xs"
              variant="secondary"
              disabled={busy || duration <= 0}
              title="An der Abspielposition teilen (S)"
              onClick={() => applySplit(currentTime)}
            >
              <SplitIcon data-icon="inline-start" />
              Teilen (S)
            </Button>
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={busy || !selected || ranges.length <= 1}
              title="Ausgewählten Abschnitt entfernen (Entf)"
              onClick={removeSelected}
            >
              <Trash2Icon data-icon="inline-start" />
              Löschen (Entf)
            </Button>
          </div>
        </div>

        <div
          ref={trackRef}
          className="relative mt-3"
          role="slider"
          aria-label="Zeitleiste"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
        >
          <div
            className="h-2.5 cursor-pointer rounded-t-md bg-secondary"
            onPointerDown={(e) => {
              if (duration <= 0) return;
              startDrag({ kind: "playhead" }, e);
              if (trackRef.current) {
                scrubTo(timeFromClientX(e.clientX, trackRef.current, duration));
              }
            }}
          />
          <div
            className="relative h-14 cursor-pointer rounded-b-md bg-muted"
            onPointerDown={(e) => {
              if (duration <= 0) return;
              startDrag({ kind: "playhead" }, e);
              if (trackRef.current) {
                scrubTo(timeFromClientX(e.clientX, trackRef.current, duration));
              }
            }}
          >
            {sortedRanges(ranges).map((range, index) => {
              const left = duration > 0 ? (range.start / duration) * 100 : 0;
              const widthPct =
                duration > 0 ? ((range.end - range.start) / duration) * 100 : 0;
              const selectedRange = range.id === selectedId;
              const wide = widthPct >= 18;
              return (
                <div
                  key={range.id}
                  className={cn(
                    "absolute top-1.5 bottom-1.5 overflow-hidden rounded-md",
                    selectedRange
                      ? "bg-primary ring-1 ring-foreground/30"
                      : "bg-primary/55 hover:bg-primary/70",
                  )}
                  style={{ left: `${left}%`, width: `${Math.max(widthPct, 0.6)}%` }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelectedId(range.id);
                    setGapHint(null);
                  }}
                >
                  <div className="pointer-events-none flex h-full items-center gap-1.5 px-2.5 text-[11px] text-primary-foreground">
                    <span className="shrink-0 font-medium">{index + 1}</span>
                    {wide ? (
                      <>
                        <span className="min-w-0 truncate font-mono opacity-90">
                          {formatTimecode(range.start)}–{formatTimecode(range.end)}
                        </span>
                        <span className="ml-auto shrink-0 opacity-80">
                          {formatDuration(range.end - range.start)}
                        </span>
                      </>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    aria-label={`Start von Abschnitt ${index + 1} verschieben`}
                    className="absolute top-0 bottom-0 left-0 z-10 w-2.5 cursor-ew-resize rounded-l-md bg-primary-foreground/35"
                    onPointerDown={(e) =>
                      startDrag({ kind: "range", id: range.id, edge: "start" }, e)
                    }
                  />
                  <button
                    type="button"
                    aria-label={`Ende von Abschnitt ${index + 1} verschieben`}
                    className="absolute top-0 bottom-0 right-0 z-10 w-2.5 cursor-ew-resize rounded-r-md bg-primary-foreground/35"
                    onPointerDown={(e) =>
                      startDrag({ kind: "range", id: range.id, edge: "end" }, e)
                    }
                  />
                </div>
              );
            })}
          </div>
          {duration > 0 ? (
            <div
              className="absolute top-0 bottom-0 z-20 w-4 -translate-x-1/2 cursor-ew-resize"
              style={{ left: `${(currentTime / duration) * 100}%` }}
              onPointerDown={(e) => {
                startDrag({ kind: "playhead" }, e);
              }}
            >
              <div className="mx-auto h-full w-0.5 bg-primary" />
              <div className="absolute top-0 left-1/2 size-2 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
            </div>
          ) : null}
        </div>

        {selected ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5">
            <span className="text-xs font-medium">
              Abschnitt{" "}
              {sortedRanges(ranges).findIndex((range) => range.id === selected.id) + 1}
            </span>
            <TimeField
              value={selected.start}
              disabled={busy}
              ariaLabel="Start"
              className="h-6 w-16"
              onCommit={(start) =>
                setRanges((prev) =>
                  applyRange(prev, selected.id, start, selected.end, duration),
                )
              }
            />
            <span className="text-xs text-muted-foreground">–</span>
            <TimeField
              value={selected.end}
              disabled={busy}
              ariaLabel="Ende"
              className="h-6 w-16"
              onCommit={(end) =>
                setRanges((prev) =>
                  applyRange(prev, selected.id, selected.start, end, duration),
                )
              }
            />
            <span className="text-xs text-muted-foreground">
              {formatDuration(selected.end - selected.start)}
            </span>
          </div>
        ) : null}

        {gapHint ? (
          <p className="mt-1.5 text-xs text-muted-foreground">{gapHint}</p>
        ) : null}

        {error ? (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-card/55 px-4 py-3 backdrop-blur-xl">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                title="Ausgabeauflösung. Nur Verkleinern, kein Hochskalieren."
              >
                <MonitorIcon data-icon="inline-start" />
                {activeScaleKey === ORIGINAL_SCALE
                  ? `Original${sourceSize
                    ? ` · ${formatResolution(sourceSize.width, sourceSize.height)}`
                    : ""
                  }`
                  : (downscales.find(
                    (item) =>
                      resolutionKey(item.width, item.height) === activeScaleKey,
                  )?.label ?? "Auflösung")}
                <ChevronDownIcon data-icon="inline-end" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-auto min-w-64">
              <DropdownMenuLabel>Auflösung · geschätzte Größe</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={activeScaleKey}
                onValueChange={(value) => {
                  if (typeof value === "string" && value) setScaleKey(value);
                }}
              >
                <DropdownMenuRadioItem
                  value={ORIGINAL_SCALE}
                  className="items-start py-1.5"
                  onSelect={() => setScaleKey(ORIGINAL_SCALE)}
                >
                  <ResolutionChoice
                    title="Original"
                    pixels={
                      sourceSize
                        ? formatPixels(sourceSize.width, sourceSize.height)
                        : undefined
                    }
                    bytes={originalBytes}
                  />
                </DropdownMenuRadioItem>
                {downscales.length > 0 ? <DropdownMenuSeparator /> : null}
                {downscales.map((item) => {
                  const key = resolutionKey(item.width, item.height);
                  return (
                    <DropdownMenuRadioItem
                      key={key}
                      value={key}
                      className="items-start py-1.5"
                      onSelect={() => setScaleKey(key)}
                    >
                      <ResolutionChoice
                        title={item.label}
                        pixels={formatPixels(item.width, item.height)}
                        bytes={estimateFor(item.width, item.height)}
                      />
                    </DropdownMenuRadioItem>
                  );
                })}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {activeScaleKey !== ORIGINAL_SCALE ? (
            <p className="text-xs text-muted-foreground">
              Die Datei wird herunterskaliert.
            </p>
          ) : null}
        </div>
        <ButtonGroup aria-label="Clip speichern">
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            Abbrechen
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canExportGif}
            title="GIF aus den Behalten-Bereichen (max. 12s, 480p)"
            onClick={exportGif}
          >
            {busy && saveMode === "gif" ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <ImageIcon data-icon="inline-start" />
            )}
            Als GIF exportieren
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canSave}
            onClick={() => save(true)}
          >
            {busy && saveMode === "overwrite" ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <SaveIcon data-icon="inline-start" />
            )}
            Original überschreiben
          </Button>
          <Button type="button" disabled={!canSave} onClick={() => save(false)}>
            {busy && saveMode === "new" ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <ScissorsIcon data-icon="inline-start" />
            )}
            Als neuen Clip speichern
          </Button>
        </ButtonGroup>
      </div>
    </div>
  );
}
