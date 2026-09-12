import {
  DEFAULT_CLIP_PRESETS,
  MAX_CLIP_PRESETS,
  MIN_CLIP_PRESET_SECONDS,
} from "./app.config.js";
import { normalizeHotkey } from "./hotkeys.js";

export interface ClipPreset {
  seconds: number;
  hotkey: string | null;
}

export function defaultClipPresets(): ClipPreset[] {
  return DEFAULT_CLIP_PRESETS.map((seconds) => ({ seconds, hotkey: null }));
}

export function clipPresetSeconds(presets: ClipPreset[]): number[] {
  return presets.map((preset) => preset.seconds);
}

export function normalizeClipPresets(value: unknown): ClipPreset[] {
  if (!Array.isArray(value)) return defaultClipPresets();
  const out: ClipPreset[] = [];
  const seenSeconds = new Set<number>();
  const seenHotkeys = new Set<string>();
  for (const item of value) {
    let seconds: number;
    let hotkey: string | null = null;
    if (typeof item === "number" || typeof item === "string") {
      seconds = Number(item);
    } else if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      seconds =
        typeof rec.seconds === "number" ? rec.seconds : Number(rec.seconds);
      if (typeof rec.hotkey === "string") {
        hotkey = normalizeHotkey(rec.hotkey);
      }
    } else {
      continue;
    }
    if (!Number.isInteger(seconds)) continue;
    if (seconds < MIN_CLIP_PRESET_SECONDS) continue;
    if (seenSeconds.has(seconds)) continue;
    seenSeconds.add(seconds);
    if (hotkey && seenHotkeys.has(hotkey)) hotkey = null;
    if (hotkey) seenHotkeys.add(hotkey);
    out.push({ seconds, hotkey });
    if (out.length >= MAX_CLIP_PRESETS) break;
  }
  return out.length > 0 ? out : defaultClipPresets();
}

export interface AppConfigDto {
  OBS_URL: string;
  OBS_PASSWORD: string;
  /** Empty = do not force a scene; OBS keeps its current program scene. */
  OBS_SCENE: string;
  /** Desired OBS Replay Buffer duration in seconds; `null` = do not override OBS. */
  OBS_REPLAY_SECONDS: number | null;
  /** Full path to `obs64.exe`; empty = auto-detect under Program Files. */
  OBS_EXE_PATH: string;
  CLIP_OUTPUT_DIR: string;
  AUTOSTART: boolean;
  CHECK_FOR_UPDATES: boolean;
  CLIP_PRESETS: ClipPreset[];
  QUICK_ACTION_HOTKEY: string | null;
}

export interface ObsStatus {
  connected: boolean;
  /** True when the OBS process is running, even if WebSocket is down. */
  running: boolean;
  error?: string;
  /** `null` when connected but OBS has not reported buffer state yet. */
  replayBufferActive: boolean | null;
  /** OBS "Maximum Replay Time" in seconds; `null` when disconnected or unknown. */
  replayMaxSeconds: number | null;
  /** Current OBS program scene; `null` when disconnected or unknown. */
  currentScene: string | null;
  /** OBS recording / replay output folder; `null` when unknown. */
  recordDirectory: string | null;
  /** True when OBS record dir and Easy Clip CLIP_OUTPUT_DIR differ. */
  outputDirMismatch: boolean;
}

export interface ClipRecord {
  id: string;
  filePath: string;
  name: string;
  createdAt: string;
  durationSeconds: number | null;
  /** Coded frame width; `null` when unknown. */
  width?: number | null;
  /** Coded frame height; `null` when unknown. */
  height?: number | null;
  /** Frames per second; `null` when unknown. */
  fps?: number | null;
  /** File size in bytes; `null` when the file is missing. */
  fileSizeBytes?: number | null;
  thumbnailPath: string | null;
  /** Custom protocol URL for in-app playback (`media://clip/{id}`). */
  mediaUrl?: string | null;
  missing?: boolean;
  /** True once the user has set a custom title in the app. */
  namedByUser?: boolean;
  /** Tag catalog ids assigned to this clip. Missing on legacy rows. */
  tagIds?: string[];
}

export interface TagRecord {
  id: string;
  name: string;
  createdAt: string;
}

export interface CutRange {
  start: number;
  end: number;
}

/** Target frame size for cutter downscale. Both sides must be ≤ source. */
export interface ScaleTarget {
  width: number;
  height: number;
}

export interface StorageInfo {
  outputDir: string;
  totalBytes: number;
  freeBytes: number;
  clipsBytes: number;
}

export const IpcChannels = {
  getConfig: "config:get",
  saveConfig: "config:save",
  pickOutputDir: "config:pick-output-dir",
  pickObsExe: "config:pick-obs-exe",
  getObsStatus: "obs:get-status",
  obsStatusChanged: "obs:status-changed",
  getObsScenes: "obs:get-scenes",
  createClip: "clip:create",
  listClips: "clips:list",
  clipsChanged: "clips:changed",
  renameClip: "clips:rename",
  deleteClip: "clips:delete",
  cutClip: "clips:cut",
  exportGif: "clips:export-gif",
  getClip: "clips:get",
  openCutter: "clips:open-cutter",
  cutterOpenClip: "cutter:open-clip",
  openClip: "clips:open",
  revealClip: "clips:reveal",
  setClipTags: "clips:set-tags",
  listTags: "tags:list",
  createTag: "tags:create",
  renameTag: "tags:rename",
  deleteTag: "tags:delete",
  tagsChanged: "tags:changed",
  getStorage: "storage:get",
  startObs: "obs:start",
  stopObs: "obs:stop",
  hotkeysFailed: "hotkeys:failed",
  hotkeyClip: "clip:hotkey",
  quickActionOpened: "quick-action:opened",
  closeQuickAction: "quick-action:close",
  selectQuickAction: "quick-action:select",
  clipConfirm: "clip:confirm",
  openExternal: "shell:open-external",
  isPackaged: "app:is-packaged",
  getVersion: "app:get-version",
  checkForUpdates: "app:check-for-updates",
  updateAvailable: "app:update-available",
} as const;

export type CreateClipResult =
  | { ok: true; outputPath: string }
  | { ok: false; error: string };

export type RenameClipResult =
  | { ok: true; clip: ClipRecord }
  | { ok: false; error: string };

export type SetClipTagsResult =
  | { ok: true; clip: ClipRecord }
  | { ok: false; error: string };

export type TagResult =
  | { ok: true; tag: TagRecord }
  | { ok: false; error: string };

export type CutClipResult =
  | { ok: true; clip: ClipRecord }
  | { ok: false; error: string };

export type ExportGifResult =
  | { ok: true; outputPath: string }
  | { ok: false; error: string };

export type StorageInfoResult =
  | { ok: true; info: StorageInfo }
  | { ok: false; error: string };

export type ObsScenesResult =
  | { ok: true; scenes: string[]; currentScene: string | null }
  | { ok: false; error: string };

export interface HotkeyClipPayload {
  seconds: number;
  result: CreateClipResult;
  title?: string;
  tagIds?: string[];
}

export interface ClipConfirmPayload {
  ok: boolean;
  seconds: number;
  title?: string;
  error?: string;
}

export interface AppUpdateInfo {
  version: string;
  url: string;
}

export type CheckForUpdatesResult =
  | { ok: true; update: AppUpdateInfo | null }
  | { ok: false; error: string };

export interface ElectronApi {
  getConfig(): Promise<AppConfigDto>;
  saveConfig(config: AppConfigDto): Promise<AppConfigDto>;
  pickOutputDir(): Promise<string | null>;
  pickObsExe(): Promise<string | null>;
  getObsStatus(): Promise<ObsStatus>;
  onObsStatus(callback: (status: ObsStatus) => void): () => void;
  getObsScenes(): Promise<ObsScenesResult>;
  createClip(seconds: number): Promise<CreateClipResult>;
  listClips(): Promise<ClipRecord[]>;
  onClipsChanged(callback: (clips: ClipRecord[]) => void): () => void;
  renameClip(id: string, name: string): Promise<RenameClipResult>;
  setClipTags(id: string, tagIds: string[]): Promise<SetClipTagsResult>;
  deleteClip(id: string): Promise<{ ok: boolean; error?: string }>;
  listTags(): Promise<TagRecord[]>;
  createTag(name: string): Promise<TagResult>;
  renameTag(id: string, name: string): Promise<TagResult>;
  deleteTag(id: string): Promise<{ ok: boolean; error?: string }>;
  onTagsChanged(callback: (tags: TagRecord[]) => void): () => void;
  cutClip(
    id: string,
    ranges: CutRange[],
    overwrite?: boolean,
    scale?: ScaleTarget | null,
    name?: string | null,
  ): Promise<CutClipResult>;
  exportGif(id: string, ranges: CutRange[]): Promise<ExportGifResult>;
  getClip(id: string): Promise<ClipRecord | null>;
  openCutter(id?: string): Promise<{ ok: boolean; error?: string }>;
  onCutterOpenClip(callback: (id: string) => void): () => void;
  openClip(id: string): Promise<{ ok: boolean; error?: string }>;
  revealClip(id: string): Promise<{ ok: boolean; error?: string }>;
  getStorage(): Promise<StorageInfoResult>;
  startObs(): Promise<{ ok: boolean; error?: string }>;
  stopObs(): Promise<{ ok: boolean; error?: string }>;
  onHotkeysFailed(callback: (accelerators: string[]) => void): () => void;
  onHotkeyClip(callback: (payload: HotkeyClipPayload) => void): () => void;
  onQuickActionOpened(callback: () => void): () => void;
  onClipConfirm(callback: (payload: ClipConfirmPayload) => void): () => void;
  closeQuickAction(): Promise<void>;
  selectQuickAction(seconds: number, title?: string, tagIds?: string[]): Promise<void>;
  openExternal(url: string): Promise<{ ok: boolean; error?: string }>;
  isPackaged(): Promise<boolean>;
  getVersion(): Promise<string>;
  checkForUpdates(): Promise<CheckForUpdatesResult>;
  onUpdateAvailable(callback: (update: AppUpdateInfo) => void): () => void;
}

declare global {
  interface Window {
    api: ElectronApi;
  }
}
