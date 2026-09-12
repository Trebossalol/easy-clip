import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { OBSWebSocket } from "obs-websocket-js";
import { DOWNSCALE_CRF, MIN_CUT_RANGE_SECONDS } from "./app.config.js";
import type { CutRange, ScaleTarget } from "./ipc.js";
import type { RunLog } from "./log.js";
import { ensureDir, getFfmpegPath, getFfprobePath, yearMonthDir } from "./paths.js";

const execFileAsync = promisify(execFile);

const FFMPEG_OPTS = { maxBuffer: 10 * 1024 * 1024, windowsHide: true } as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Best-effort delete of the full OBS replay after a successful trim. */
async function deleteReplaySource(filePath: string, log?: RunLog): Promise<void> {
  const attempts = 3;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      await sleep(250 * 2 ** (i - 1));
    }
    try {
      if (!fs.existsSync(filePath)) {
        log?.info(`Source replay already gone: ${filePath}`);
        return;
      }
      fs.unlinkSync(filePath);
      log?.info(`Deleted source replay: ${filePath}`);
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log?.info(
        `Could not delete source replay (attempt ${i + 1}/${attempts}): ${message}`,
      );
    }
  }
  log?.info(`Left source replay on disk: ${filePath}`);
}

function fileSize(filePath: string): number | null {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return null;
  }
}

function ffmpegMessage(err: unknown): string {
  if (err && typeof err === "object" && "stderr" in err) {
    const stderr = String((err as { stderr: unknown }).stderr).trim();
    if (stderr) {
      const lines = stderr.split(/\r?\n/).filter(Boolean);
      return lines.slice(-6).join("\n") || stderr;
    }
  }
  return err instanceof Error ? err.message : String(err);
}

export interface VideoInfo {
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
}

type ProbeStream = {
  width?: unknown;
  height?: unknown;
  r_frame_rate?: unknown;
  avg_frame_rate?: unknown;
};

function positiveInt(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** `60/1`, `30000/1001`, or a plain number. */
function parseFrameRate(value: unknown): number | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw || raw === "0/0") return null;
  const slash = raw.indexOf("/");
  let fps: number;
  if (slash >= 0) {
    const num = Number(raw.slice(0, slash));
    const den = Number(raw.slice(slash + 1));
    if (!(num > 0) || !(den > 0)) return null;
    fps = num / den;
  } else {
    fps = Number(raw);
  }
  if (!Number.isFinite(fps) || fps < 1 || fps > 240) return null;
  return fps;
}

function streamFps(stream: ProbeStream | undefined): number | null {
  if (!stream) return null;
  return parseFrameRate(stream.avg_frame_rate) ?? parseFrameRate(stream.r_frame_rate);
}

export async function getVideoInfo(filePath: string): Promise<VideoInfo> {
  const streamEntries = "stream=width,height,r_frame_rate,avg_frame_rate";
  const { stdout } = await execFileAsync(
    getFfprobePath(),
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      `${streamEntries}:format=duration`,
      "-of",
      "json",
      filePath,
    ],
    FFMPEG_OPTS,
  );
  const parsed = JSON.parse(stdout) as {
    streams?: ProbeStream[];
    format?: { duration?: unknown };
  };
  let stream = parsed.streams?.find(
    (item) => positiveInt(item.width) != null && positiveInt(item.height) != null,
  );
  if (!stream) {
    const retry = await execFileAsync(
      getFfprobePath(),
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        streamEntries,
        "-of",
        "json",
        filePath,
      ],
      FFMPEG_OPTS,
    );
    const retryParsed = JSON.parse(retry.stdout) as {
      streams?: ProbeStream[];
    };
    stream = retryParsed.streams?.[0];
  }
  const duration = parseFloat(String(parsed.format?.duration ?? ""));
  return {
    durationSeconds:
      Number.isFinite(duration) && duration > 0 ? duration : null,
    width: positiveInt(stream?.width),
    height: positiveInt(stream?.height),
    fps: streamFps(stream),
  };
}

export async function getVideoDuration(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync(
    getFfprobePath(),
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ],
    FFMPEG_OPTS,
  );
  const duration = parseFloat(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Die Clip-Dauer konnte nicht ermittelt werden.");
  }
  return duration;
}

export function normalizeCutRanges(
  ranges: CutRange[],
  duration: number,
): CutRange[] {
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Die Clip-Dauer konnte nicht ermittelt werden.");
  }
  if (!ranges.length) {
    throw new Error("Mindestens ein Bereich muss ausgewählt werden.");
  }

  const cleaned = ranges.map((range, index) => {
    const start = Number(range.start);
    const end = Number(range.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      throw new Error(`Bereich ${index + 1} hat ungültige Zeiten.`);
    }
    if (start < 0 || end > duration + 0.05) {
      throw new Error(`Bereich ${index + 1} liegt außerhalb der Clip-Dauer.`);
    }
    if (end - start < MIN_CUT_RANGE_SECONDS) {
      throw new Error(
        `Bereich ${index + 1} ist zu kurz (mindestens ${MIN_CUT_RANGE_SECONDS}s).`,
      );
    }
    return {
      start: Math.max(0, start),
      end: Math.min(duration, end),
    };
  });

  cleaned.sort((a, b) => a.start - b.start);

  for (let i = 1; i < cleaned.length; i++) {
    const prev = cleaned[i - 1]!;
    const next = cleaned[i]!;
    if (next.start < prev.end - 0.01) {
      throw new Error("Bereiche dürfen sich nicht überschneiden.");
    }
  }

  return cleaned;
}

async function runFfmpeg(args: string[], log?: RunLog): Promise<void> {
  log?.info(`ffmpeg ${args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`);
  try {
    const { stdout, stderr } = await execFileAsync(getFfmpegPath(), args, FFMPEG_OPTS);
    if (stdout.trim()) {
      log?.info(`ffmpeg stdout:\n${stdout.trim()}`);
    }
    if (stderr.trim()) {
      log?.info(`ffmpeg stderr:\n${stderr.trim()}`);
    }
  } catch (err) {
    throw new Error(ffmpegMessage(err));
  }
}

function scaleFilter(scale: ScaleTarget): string {
  return (
    `scale=${scale.width}:${scale.height}:flags=lanczos:force_original_aspect_ratio=decrease:force_divisible_by=2,` +
    `pad=${scale.width}:${scale.height}:(ow-iw)/2:(oh-ih)/2`
  );
}

function encodeArgs(dst: string, scale?: ScaleTarget | null): string[] {
  const args = ["-map", "0:v:0", "-map", "0:a?"];
  if (scale) {
    args.push("-vf", scaleFilter(scale));
  }
  args.push(
    "-c:v",
    "libx264",
    "-crf",
    "18",
    "-preset",
    "medium",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "copy",
  );
  const ext = path.extname(dst).toLowerCase();
  if (ext === ".mp4" || ext === ".m4v" || ext === ".mov") {
    args.push("-movflags", "+faststart");
  }
  return args;
}

/**
 * Frame-accurate extract. `-c copy` can only cut on keyframes (OBS often uses
 * a 2s GOP), so a 10s selection would export as ~12–14s.
 */
async function extractRange(
  src: string,
  dst: string,
  start: number,
  duration: number,
  log?: RunLog,
  scale?: ScaleTarget | null,
): Promise<void> {
  await runFfmpeg(
    [
      "-y",
      "-ss",
      String(start),
      "-i",
      src,
      "-t",
      String(duration),
      ...encodeArgs(dst, scale),
      dst,
    ],
    log,
  );
}

function concatListLine(filePath: string): string {
  const posix = filePath.replace(/\\/g, "/").replace(/'/g, "'\\''");
  return `file '${posix}'`;
}

async function concatSegments(
  files: string[],
  dst: string,
  log?: RunLog,
): Promise<void> {
  const listPath = path.join(path.dirname(files[0]!), "concat.txt");
  fs.writeFileSync(listPath, files.map(concatListLine).join("\n"), "utf8");
  await runFfmpeg(
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c",
      "copy",
      "-avoid_negative_ts",
      "make_zero",
      dst,
    ],
    log,
  );
}

function coerceScale(value: ScaleTarget | null | undefined): ScaleTarget | null {
  if (value == null) return null;
  const width = Number(value.width);
  const height = Number(value.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error("Ungültige Zielauflösung.");
  }
  if (width % 2 !== 0 || height % 2 !== 0) {
    throw new Error("Die Zielauflösung muss gerade Zahlen verwenden.");
  }
  return { width, height };
}

function resolveDownscale(
  requested: ScaleTarget | null | undefined,
  source: VideoInfo,
  log?: RunLog,
): ScaleTarget | null {
  const scale = coerceScale(requested);
  if (!scale) return null;
  if (source.width == null || source.height == null) {
    throw new Error("Die Auflösung der Quelle konnte nicht ermittelt werden.");
  }
  if (scale.width > source.width || scale.height > source.height) {
    throw new Error("Hochskalieren ist nicht möglich.");
  }
  if (scale.width === source.width && scale.height === source.height) {
    return null;
  }
  log?.info(`Downscale ${source.width}x${source.height} → ${scale.width}x${scale.height}`);
  return scale;
}

async function scaleVideoToFile(
  src: string,
  dst: string,
  scale: ScaleTarget,
  log?: RunLog,
): Promise<void> {
  const vf =
    `scale=${scale.width}:${scale.height}:flags=lanczos:force_original_aspect_ratio=decrease:force_divisible_by=2,` +
    `pad=${scale.width}:${scale.height}:(ow-iw)/2:(oh-ih)/2`;
  const ext = path.extname(dst).toLowerCase();
  const args = [
    "-y",
    "-i",
    src,
    "-map",
    "0:v:0",
    "-map",
    "0:a?",
    "-vf",
    vf,
    "-c:v",
    "libx264",
    "-crf",
    String(DOWNSCALE_CRF),
    "-preset",
    "medium",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "copy",
  ];
  if (ext === ".mp4" || ext === ".m4v" || ext === ".mov") {
    args.push("-movflags", "+faststart");
  }
  args.push(dst);
  await runFfmpeg(args, log);
}

export async function cutVideoToFile(
  src: string,
  dst: string,
  ranges: CutRange[],
  options?: { log?: RunLog; scale?: ScaleTarget | null },
): Promise<{
  durationSeconds: number;
  width: number | null;
  height: number | null;
  fps: number | null;
}> {
  if (!fs.existsSync(src)) {
    throw new Error("Die Clip-Datei fehlt.");
  }

  const log = options?.log;
  const total = await getVideoDuration(src);
  const normalized = normalizeCutRanges(ranges, total);
  log?.info(`Source duration: ${total}s`);
  log?.info(
    `Keeping ${normalized.length} range(s): ${normalized
      .map((r) => `${r.start.toFixed(2)}–${r.end.toFixed(2)}`)
      .join(", ")}`,
  );

  const scaleTo = resolveDownscale(options?.scale, await getVideoInfo(src), log);

  ensureDir(path.dirname(dst));

  const ext = path.extname(src) || ".mp4";
  const cutDest = scaleTo
    ? path.join(os.tmpdir(), `easyclip-cut-${crypto.randomUUID()}${ext}`)
    : dst;

  try {
    if (normalized.length === 1) {
      const range = normalized[0]!;
      await extractRange(src, cutDest, range.start, range.end - range.start, log);
    } else {
      const tmp = path.join(os.tmpdir(), `easyclip-cut-${crypto.randomUUID()}`);
      ensureDir(tmp);
      try {
        const parts: string[] = [];
        for (let i = 0; i < normalized.length; i++) {
          const range = normalized[i]!;
          const part = path.join(tmp, `seg-${i}${ext}`);
          await extractRange(src, part, range.start, range.end - range.start, log);
          parts.push(part);
        }
        await concatSegments(parts, cutDest, log);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    }

    if (scaleTo) {
      await scaleVideoToFile(cutDest, dst, scaleTo, log);
    }
  } finally {
    if (scaleTo && cutDest !== dst) {
      try {
        if (fs.existsSync(cutDest)) fs.unlinkSync(cutDest);
      } catch {
        // Temp cleanup is best-effort.
      }
    }
  }

  let durationSeconds: number;
  let width: number | null = null;
  let height: number | null = null;
  let fps: number | null = null;
  try {
    const out = await getVideoInfo(dst);
    width = out.width;
    height = out.height;
    fps = out.fps;
    durationSeconds = out.durationSeconds ?? (await getVideoDuration(dst));
  } catch {
    durationSeconds = await getVideoDuration(dst);
  }
  log?.info(`Output file: ${dst} (${fileSize(dst)} bytes)`);
  log?.info(`Output duration: ${durationSeconds}s`);
  if (width && height) {
    log?.info(`Output size: ${width}x${height}`);
  }
  if (
    scaleTo &&
    width != null &&
    height != null &&
    (width !== scaleTo.width || height !== scaleTo.height)
  ) {
    throw new Error(
      `Die Ausgabeauflösung ist ${width}×${height}, erwartet ${scaleTo.width}×${scaleTo.height}.`,
    );
  }
  return { durationSeconds, width, height, fps };
}

const MAX_GIF_KEEP_SECONDS = 12;
const GIF_MAX_WIDTH = 480;
const GIF_FPS = 12;

export async function exportGifToFile(
  src: string,
  dst: string,
  ranges: CutRange[],
  options?: { log?: RunLog },
): Promise<{ durationSeconds: number }> {
  if (!fs.existsSync(src)) {
    throw new Error("Die Clip-Datei fehlt.");
  }

  const log = options?.log;
  const total = await getVideoDuration(src);
  const normalized = normalizeCutRanges(ranges, total);
  const keepSeconds = normalized.reduce(
    (sum, range) => sum + (range.end - range.start),
    0,
  );
  if (keepSeconds > MAX_GIF_KEEP_SECONDS + 0.05) {
    throw new Error(
      `GIF-Export ist auf höchstens ${MAX_GIF_KEEP_SECONDS}s begrenzt. Kürze die Behalten-Bereiche.`,
    );
  }

  ensureDir(path.dirname(dst));
  const work = path.join(os.tmpdir(), `easyclip-gif-${crypto.randomUUID()}`);
  ensureDir(work);
  const ext = path.extname(src) || ".mp4";
  const cutPath = path.join(work, `cut${ext}`);
  const palettePath = path.join(work, "palette.png");

  try {
    if (normalized.length === 1) {
      const range = normalized[0]!;
      await extractRange(src, cutPath, range.start, range.end - range.start, log);
    } else {
      const parts: string[] = [];
      for (let i = 0; i < normalized.length; i++) {
        const range = normalized[i]!;
        const part = path.join(work, `seg-${i}${ext}`);
        await extractRange(src, part, range.start, range.end - range.start, log);
        parts.push(part);
      }
      await concatSegments(parts, cutPath, log);
    }

    const scaleFilter =
      `fps=${GIF_FPS},scale=${GIF_MAX_WIDTH}:-1:flags=lanczos:force_original_aspect_ratio=decrease:force_divisible_by=2`;
    await runFfmpeg(
      ["-y", "-i", cutPath, "-vf", `${scaleFilter},palettegen=stats_mode=diff`, palettePath],
      log,
    );
    await runFfmpeg(
      [
        "-y",
        "-i",
        cutPath,
        "-i",
        palettePath,
        "-lavfi",
        `${scaleFilter}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5`,
        "-loop",
        "0",
        dst,
      ],
      log,
    );

    let durationSeconds: number;
    try {
      durationSeconds = (await getVideoInfo(dst)).durationSeconds ?? keepSeconds;
    } catch {
      durationSeconds = keepSeconds;
    }
    log?.info(`GIF output: ${dst} (${fileSize(dst)} bytes)`);
    return { durationSeconds };
  } finally {
    try {
      fs.rmSync(work, { recursive: true, force: true });
    } catch {
      // Temp cleanup is best-effort.
    }
  }
}

export interface SaveAndTrimOptions {
  obs: OBSWebSocket;
  seconds: number;
  outputDir: string;
  log?: RunLog;
  /** Timestamp used for YYYY/MM folder; defaults to now. */
  createdAt?: Date;
  /** Called as soon as OBS reports the saved replay path (before trim). */
  onReplaySaved?: (savedPath: string) => void;
}

export interface SaveAndTrimResult {
  outputPath: string;
  sourcePath: string;
  durationSeconds: number;
}

export async function saveAndTrimClip(
  options: SaveAndTrimOptions,
): Promise<SaveAndTrimResult> {
  const { obs, seconds, outputDir, log } = options;
  const createdAt = options.createdAt ?? new Date();

  await obs.call("SaveReplayBuffer");
  log?.info("SaveReplayBuffer requested");

  let savedPath: string | null = null;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      const status = await obs.call("GetLastReplayBufferReplay");
      log?.info(`Poll ${i + 1}/20: ${status.savedReplayPath || "(no path yet)"}`);
      if (status.savedReplayPath && fs.existsSync(status.savedReplayPath)) {
        savedPath = status.savedReplayPath;
        break;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log?.info(`Poll ${i + 1}/20: not ready (${message})`);
    }
  }

  if (!savedPath) {
    throw new Error("Der Speicherpfad der Wiederholungspuffer-Datei konnte nicht ermittelt werden.");
  }

  log?.info(`Replay file: ${savedPath} (${fileSize(savedPath)} bytes)`);
  options.onReplaySaved?.(savedPath);

  const monthDir = yearMonthDir(outputDir, createdAt);
  ensureDir(monthDir);

  const ext = path.extname(savedPath);
  const base = path.basename(savedPath, ext);
  const dst = path.join(monthDir, `${base}_${seconds}s${ext}`);

  const total = await getVideoDuration(savedPath);
  const start = Math.max(0, total - seconds);
  log?.info(`Replay duration: ${total}s`);
  log?.info(`Trim start: ${start}s (keeping last ${seconds}s)`);

  const { durationSeconds } = await cutVideoToFile(
    savedPath,
    dst,
    [{ start, end: total }],
    { log },
  );

  log?.info(`Saved ${seconds}s clip: ${dst}`);

  if (path.normalize(savedPath).toLowerCase() !== path.normalize(dst).toLowerCase()) {
    await deleteReplaySource(savedPath, log);
  }

  return {
    outputPath: dst,
    sourcePath: savedPath,
    durationSeconds,
  };
}
