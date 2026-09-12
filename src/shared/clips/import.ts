import fs from "node:fs";
import path from "node:path";
import { getVideoInfo } from "../clip-service.js";
import type { ClipRecord } from "../ipc.js";
import { ensureDir, isVideoFile } from "../paths.js";
import { generateThumbnail } from "../thumbnail.js";
import { beginImport, endImport, ignorePathTemporarily } from "./ignore.js";
import { moveIntoYearMonth, sanitizeFileStem, uniquePath, walkVideos } from "./files.js";
import {
  listClips,
  newClipId,
  readStore,
  thumbnailsDir,
  writeStore,
} from "./store.js";
import type { ClipsStoreOptions } from "./types.js";
import { sanitizeTagIds } from "../tags/store.js";

function applyUserFileName(
  filePath: string,
  name: string | undefined,
): { filePath: string; namedByUser: boolean } {
  const requested = name?.trim();
  if (!requested) return { filePath, namedByUser: false };
  const stem = sanitizeFileStem(requested);
  if (!stem) return { filePath, namedByUser: false };
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  if (stem === path.basename(filePath, ext)) {
    return { filePath, namedByUser: true };
  }
  const dest = uniquePath(dir, stem, ext);
  if (path.normalize(dest) !== path.normalize(filePath)) {
    ignorePathTemporarily(filePath);
    ignorePathTemporarily(dest);
    try {
      fs.renameSync(filePath, dest);
    } catch {
      return { filePath, namedByUser: false };
    }
    return { filePath: dest, namedByUser: true };
  }
  return { filePath, namedByUser: true };
}

export async function importClipFromFile(
  options: ClipsStoreOptions,
  filePath: string,
  opts?: {
    createdAt?: Date;
    durationSeconds?: number | null;
    name?: string;
    namedByUser?: boolean;
    tagIds?: string[];
  },
): Promise<ClipRecord | null> {
  const { appDataDir, outputDir } = options;
  if (!fs.existsSync(filePath) || !isVideoFile(filePath)) return null;

  if (!beginImport(filePath)) return null;

  try {
    const clips = readStore(appDataDir);
    const normalized = path.normalize(filePath);
    if (clips.some((c) => path.normalize(c.filePath) === normalized)) {
      return null;
    }

    const stat = fs.statSync(filePath);
    const createdAt = opts?.createdAt ?? stat.mtime;
    const movedPath = moveIntoYearMonth(filePath, outputDir, createdAt);
    const named = applyUserFileName(movedPath, opts?.name);

    let durationSeconds = opts?.durationSeconds ?? null;
    let width: number | null = null;
    let height: number | null = null;
    let fps: number | null = null;
    try {
      const info = await getVideoInfo(named.filePath);
      durationSeconds = durationSeconds ?? info.durationSeconds;
      width = info.width;
      height = info.height;
      fps = info.fps;
    } catch {
      // Duration / size stay whatever we already have.
    }

    const id = newClipId();
    const thumbnailPath = await generateThumbnail(
      named.filePath,
      thumbnailsDir(appDataDir),
      id,
    );

    const record: ClipRecord = {
      id,
      filePath: named.filePath,
      name: path.basename(named.filePath, path.extname(named.filePath)),
      createdAt: createdAt.toISOString(),
      durationSeconds,
      width,
      height,
      fps,
      thumbnailPath,
      missing: false,
      namedByUser: opts?.namedByUser ?? named.namedByUser,
      tagIds: sanitizeTagIds(appDataDir, opts?.tagIds),
    };

    // Re-read in case another import finished while we were working
    const latest = readStore(appDataDir);
    if (latest.some((c) => path.normalize(c.filePath) === path.normalize(named.filePath))) {
      return null;
    }
    latest.unshift(record);
    writeStore(appDataDir, latest);
    return record;
  } finally {
    endImport(filePath);
  }
}

export async function scanAndImportExisting(
  options: ClipsStoreOptions,
): Promise<ClipRecord[]> {
  const { appDataDir, outputDir } = options;
  ensureDir(outputDir);
  const existing = readStore(appDataDir);
  const known = new Set(existing.map((c) => path.normalize(c.filePath).toLowerCase()));
  const files = walkVideos(outputDir);
  const added: ClipRecord[] = [];

  for (const file of files) {
    if (known.has(path.normalize(file).toLowerCase())) continue;
    const record = await importClipFromFile(options, file);
    if (record) {
      added.push(record);
      known.add(path.normalize(record.filePath).toLowerCase());
    }
  }

  // Refresh missing flags, probe size for older rows, persist year/month moves
  const clips = readStore(appDataDir);
  let changed = false;
  for (const clip of clips) {
    if (!fs.existsSync(clip.filePath)) {
      if (!clip.missing) {
        clip.missing = true;
        changed = true;
      }
      continue;
    }
    const date = new Date(clip.createdAt);
    const moved = moveIntoYearMonth(clip.filePath, outputDir, date);
    if (moved !== clip.filePath) {
      clip.filePath = moved;
      clip.missing = false;
      changed = true;
    }
    if (clip.width == null || clip.height == null || clip.fps == null) {
      try {
        const info = await getVideoInfo(clip.filePath);
        if (info.width != null && info.height != null) {
          clip.width = info.width;
          clip.height = info.height;
          changed = true;
        }
        if (info.fps != null) {
          clip.fps = info.fps;
          changed = true;
        }
        if (clip.durationSeconds == null && info.durationSeconds != null) {
          clip.durationSeconds = info.durationSeconds;
          changed = true;
        }
      } catch {
        // Probe is best-effort for legacy library rows.
      }
    }
  }
  if (changed) writeStore(appDataDir, clips);

  return listClips(appDataDir);
}
