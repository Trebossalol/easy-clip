import { DOWNSCALE_CRF } from "@shared/app.config";

export interface NamedResolution {
  width: number;
  height: number;
  label: string;
}

/** Larger first so the cutter lists FHD before HD. */
export const NAMED_RESOLUTIONS: NamedResolution[] = [
  { width: 7680, height: 4320, label: "8K" },
  { width: 7680, height: 2160, label: "FUHD" },
  { width: 5120, height: 2160, label: "5K" },
  { width: 5120, height: 1440, label: "DQHD" },
  { width: 4096, height: 2160, label: "DCI 4K" },
  { width: 3840, height: 2160, label: "UHD" },
  { width: 3840, height: 1600, label: "UWQHD+" },
  { width: 3840, height: 1080, label: "DFHD" },
  { width: 3440, height: 1440, label: "UWQHD" },
  { width: 2560, height: 1600, label: "WQXGA" },
  { width: 2560, height: 1440, label: "WQHD" },
  { width: 2560, height: 1080, label: "UWFHD" },
  { width: 2048, height: 1080, label: "2K" },
  { width: 1920, height: 1200, label: "WUXGA" },
  { width: 1920, height: 1080, label: "FHD" },
  { width: 1600, height: 900, label: "HD+" },
  { width: 1366, height: 768, label: "WXGA" },
  { width: 1280, height: 720, label: "HD" },
  { width: 854, height: 480, label: "SD" },
];

const RESOLUTION_LABELS: Record<string, string> = Object.fromEntries(
  NAMED_RESOLUTIONS.map((item) => [`${item.width}x${item.height}`, item.label]),
);

export function formatPixels(
  width: number | null | undefined,
  height: number | null | undefined,
): string {
  if (width == null || height == null || width <= 0 || height <= 0) return "";
  return `${width}×${height}`;
}

export function formatResolution(
  width: number | null | undefined,
  height: number | null | undefined,
): string {
  const pixels = formatPixels(width, height);
  if (!pixels) return "";
  return RESOLUTION_LABELS[`${width}x${height}`] ?? pixels;
}

export function resolutionKey(width: number, height: number): string {
  return `${width}x${height}`;
}

/** Named sizes strictly smaller than the source on at least one side, never larger. */
export function downscaleResolutions(
  width: number | null | undefined,
  height: number | null | undefined,
): NamedResolution[] {
  if (width == null || height == null || width <= 0 || height <= 0) return [];
  return NAMED_RESOLUTIONS.filter(
    (item) =>
      item.width <= width &&
      item.height <= height &&
      (item.width < width || item.height < height),
  );
}

/** ~192 kbit/s AAC; used when the source audio share is unknown. */
const AUDIO_BYTES_PER_SEC = 24_000;

/** OBS clips are usually 60 fps when the file does not report a rate. */
const DEFAULT_FPS = 60;

/**
 * Typical bits/pixel/frame for game/screen content at x264 CRF 18 medium.
 * CRF size follows quality × pixels × fps, not the source bitrate.
 */
const CRF18_BITS_PER_PIXEL = 0.18;

function fittedPixelCount(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): number {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight, 1);
  const width = Math.max(2, Math.floor((sourceWidth * scale) / 2) * 2);
  const height = Math.max(2, Math.floor((sourceHeight * scale) / 2) * 2);
  return width * height;
}

function crfBitsPerPixel(crf: number): number {
  return CRF18_BITS_PER_PIXEL * 2 ** ((18 - crf) / 6);
}

function estimateCopiedAudioBytes(
  fileSizeBytes: number | null | undefined,
  sourceDuration: number,
  keepDuration: number,
): number {
  const keepRatio = Math.min(1, keepDuration / sourceDuration);
  if (fileSizeBytes != null && fileSizeBytes > 0) {
    const sourceAudio = Math.min(
      fileSizeBytes * 0.12,
      AUDIO_BYTES_PER_SEC * sourceDuration,
    );
    return sourceAudio * keepRatio;
  }
  return AUDIO_BYTES_PER_SEC * keepDuration;
}

function sanitizeFps(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value) || value < 1 || value > 240) {
    return DEFAULT_FPS;
  }
  return value;
}

/** Stream-copy for original. Downscale uses the cutter's x264 CRF encode. */
export function estimateOutputBytes(options: {
  fileSizeBytes: number | null | undefined;
  sourceDuration: number;
  keepDuration: number;
  sourceWidth: number;
  sourceHeight: number;
  targetWidth?: number | null;
  targetHeight?: number | null;
  fps?: number | null;
}): number | null {
  const {
    fileSizeBytes,
    sourceDuration,
    keepDuration,
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
    fps,
  } = options;
  if (
    sourceDuration <= 0 ||
    keepDuration <= 0 ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    return null;
  }
  const keepRatio = Math.min(1, keepDuration / sourceDuration);
  const original =
    targetWidth == null ||
    targetHeight == null ||
    (targetWidth === sourceWidth && targetHeight === sourceHeight);
  if (original) {
    if (fileSizeBytes == null || fileSizeBytes <= 0) return null;
    return Math.max(1, Math.round(fileSizeBytes * keepRatio));
  }
  const targetPixels = fittedPixelCount(
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
  );
  const videoBytes =
    (targetPixels * sanitizeFps(fps) * keepDuration * crfBitsPerPixel(DOWNSCALE_CRF)) /
    8;
  const audioBytes = estimateCopiedAudioBytes(
    fileSizeBytes,
    sourceDuration,
    keepDuration,
  );
  return Math.max(1, Math.round(videoBytes + audioBytes));
}

export function formatEstimateBytes(bytes: number): string {
  return `ca. ${formatBytes(bytes)}`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null || Number.isNaN(seconds)) return "";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}

export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds + 1e-6);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function parseTimecode(value: string): number | null {
  const raw = value.trim().replace(",", ".");
  if (!raw) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  const parts = raw.split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  const nums = parts.map((part) => Number(part));
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (parts.length === 2) return nums[0]! * 60 + nums[1]!;
  return nums[0]! * 3600 + nums[1]! * 60 + nums[2]!;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 ? 0 : 1;
  return `${value.toLocaleString("de-DE", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  })} ${units[unit]}`;
}

export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const now = new Date();
    const time = d.toLocaleTimeString("de-DE", {
      hour: "numeric",
      minute: "2-digit",
    });
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const startOfThat = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
    ).getTime();
    const dayDiff = Math.round((startOfToday - startOfThat) / 86_400_000);
    if (dayDiff === 0) return `Heute, ${time}`;
    if (dayDiff === 1) return `Gestern, ${time}`;
    return d.toLocaleString("de-DE", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
