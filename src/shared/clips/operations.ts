import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cutVideoToFile } from "../clip-service.js";
import type { ClipRecord, CutRange, ScaleTarget } from "../ipc.js";
import { generateThumbnail } from "../thumbnail.js";
import { ignorePathTemporarily } from "./ignore.js";
import { importClipFromFile } from "./import.js";
import { sanitizeFileStem, uniquePath } from "./files.js";
import {
  findClip,
  listClips,
  readStore,
  thumbnailsDir,
  unlinkThumbnail,
  writeStore,
} from "./store.js";
import type { ClipsStoreOptions } from "./types.js";
import { sanitizeTagIds } from "../tags/store.js";
import { clipTagIds } from "../tags/names.js";

export function renameClip(
  appDataDir: string,
  id: string,
  newName: string,
): { ok: true; clip: ClipRecord } | { ok: false; error: string } {
  const clips = readStore(appDataDir);
  const index = clips.findIndex((c) => c.id === id);
  if (index < 0) return { ok: false, error: "Clip nicht gefunden." };

  const clip = clips[index]!;
  const stem = sanitizeFileStem(newName);
  if (!stem) {
    return { ok: false, error: "Der Name ist nach dem Entfernen ungültiger Zeichen leer." };
  }

  if (!fs.existsSync(clip.filePath)) {
    clip.name = stem;
    clip.namedByUser = true;
    clip.missing = true;
    writeStore(appDataDir, clips);
    return { ok: true, clip: { ...clip } };
  }

  const dir = path.dirname(clip.filePath);
  const ext = path.extname(clip.filePath);
  const currentStem = path.basename(clip.filePath, ext);

  if (stem === currentStem) {
    clip.name = stem;
    clip.namedByUser = true;
    writeStore(appDataDir, clips);
    return { ok: true, clip: { ...clip, missing: false } };
  }

  const dest = uniquePath(dir, stem, ext);
  ignorePathTemporarily(clip.filePath);
  ignorePathTemporarily(dest);

  try {
    fs.renameSync(clip.filePath, dest);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Datei konnte nicht umbenannt werden: ${message}` };
  }

  clip.filePath = dest;
  clip.name = path.basename(dest, ext);
  clip.namedByUser = true;
  clip.missing = false;
  writeStore(appDataDir, clips);
  return { ok: true, clip: { ...clip } };
}

export function setClipTags(
  appDataDir: string,
  id: string,
  tagIds: string[],
): { ok: true; clip: ClipRecord } | { ok: false; error: string } {
  const clips = readStore(appDataDir);
  const index = clips.findIndex((c) => c.id === id);
  if (index < 0) return { ok: false, error: "Clip nicht gefunden." };

  const clip = clips[index]!;
  clip.tagIds = sanitizeTagIds(appDataDir, tagIds);
  writeStore(appDataDir, clips);
  const live = findClip(appDataDir, id);
  return { ok: true, clip: live ?? { ...clip, tagIds: clip.tagIds } };
}

export async function deleteClip(
  appDataDir: string,
  id: string,
  moveToTrash: (filePath: string) => Promise<void>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const clips = readStore(appDataDir);
  const index = clips.findIndex((c) => c.id === id);
  if (index < 0) return { ok: false, error: "Clip nicht gefunden." };

  const clip = clips[index]!;

  if (clip.filePath && fs.existsSync(clip.filePath)) {
    ignorePathTemporarily(clip.filePath);
    try {
      await moveToTrash(clip.filePath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: `Datei konnte nicht in den Papierkorb verschoben werden: ${message}`,
      };
    }
  }

  unlinkThumbnail(appDataDir, clip.id);
  clips.splice(index, 1);
  writeStore(appDataDir, clips);
  return { ok: true };
}

/**
 * Drop a library row when its file disappeared (watcher unlink).
 * Does not delete the file — it is already gone.
 */
export function removeClipByFilePath(
  appDataDir: string,
  filePath: string,
): ClipRecord | null {
  const clips = readStore(appDataDir);
  const key = path.normalize(filePath).toLowerCase();
  const index = clips.findIndex(
    (c) => path.normalize(c.filePath).toLowerCase() === key,
  );
  if (index < 0) return null;

  const clip = clips[index]!;
  unlinkThumbnail(appDataDir, clip.id);
  clips.splice(index, 1);
  writeStore(appDataDir, clips);
  return clip;
}

export async function cutClipToNewFile(
  options: ClipsStoreOptions,
  id: string,
  ranges: CutRange[],
  scale?: ScaleTarget | null,
  name?: string | null,
): Promise<{ ok: true; clip: ClipRecord } | { ok: false; error: string }> {
  const { appDataDir } = options;
  const clip = findClip(appDataDir, id);
  if (!clip) return { ok: false, error: "Clip nicht gefunden." };
  if (!clip.filePath || !fs.existsSync(clip.filePath)) {
    return { ok: false, error: "Die Clip-Datei fehlt." };
  }

  const dir = path.dirname(clip.filePath);
  const ext = path.extname(clip.filePath) || ".mp4";
  const requested = name?.trim();
  const stem = requested
    ? sanitizeFileStem(requested)
    : `${path.basename(clip.filePath, ext)} (cut)`;
  if (!stem) {
    return { ok: false, error: "Der Name ist nach dem Entfernen ungültiger Zeichen leer." };
  }
  const dest = uniquePath(dir, stem, ext);

  ignorePathTemporarily(dest, 15 * 60_000);
  try {
    const { durationSeconds } = await cutVideoToFile(clip.filePath, dest, ranges, {
      scale,
    });
    const record = await importClipFromFile(options, dest, {
      durationSeconds,
      namedByUser: Boolean(requested),
      tagIds: clipTagIds(clip),
    });
    if (record) return { ok: true, clip: record };

    const existing = listClips(appDataDir).find(
      (c) => path.normalize(c.filePath) === path.normalize(dest),
    );
    if (existing) return { ok: true, clip: existing };
    return {
      ok: false,
      error: "Der neue Clip konnte nicht in die Bibliothek übernommen werden.",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export async function cutClipOverwrite(
  options: ClipsStoreOptions,
  id: string,
  ranges: CutRange[],
  scale?: ScaleTarget | null,
  name?: string | null,
): Promise<{ ok: true; clip: ClipRecord } | { ok: false; error: string }> {
  const { appDataDir } = options;
  const clip = findClip(appDataDir, id);
  if (!clip) return { ok: false, error: "Clip nicht gefunden." };
  if (!clip.filePath || !fs.existsSync(clip.filePath)) {
    return { ok: false, error: "Die Clip-Datei fehlt." };
  }

  const ext = path.extname(clip.filePath) || ".mp4";
  const tempDest = path.join(
    os.tmpdir(),
    `easyclip-overwrite-${crypto.randomUUID()}${ext}`,
  );

  ignorePathTemporarily(clip.filePath, 15 * 60_000);
  try {
    const { durationSeconds, width, height, fps } = await cutVideoToFile(
      clip.filePath,
      tempDest,
      ranges,
      { scale },
    );
    ignorePathTemporarily(clip.filePath, 15_000);
    fs.copyFileSync(tempDest, clip.filePath);

    const thumbnailPath = await generateThumbnail(
      clip.filePath,
      thumbnailsDir(appDataDir),
      clip.id,
    );

    const clips = readStore(appDataDir);
    const index = clips.findIndex((item) => item.id === id);
    if (index < 0) {
      return { ok: false, error: "Clip nicht gefunden." };
    }
    const updated: ClipRecord = {
      ...clips[index]!,
      durationSeconds,
      width: width ?? clips[index]!.width,
      height: height ?? clips[index]!.height,
      fps: fps ?? clips[index]!.fps,
      thumbnailPath,
      missing: false,
    };
    clips[index] = updated;
    writeStore(appDataDir, clips);
    const requested = name?.trim();
    if (requested) {
      const renamed = renameClip(appDataDir, id, requested);
      if (renamed.ok) return renamed;
    }
    return { ok: true, clip: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  } finally {
    try {
      if (fs.existsSync(tempDest)) fs.unlinkSync(tempDest);
    } catch {
      // Temp cleanup is best-effort.
    }
  }
}
