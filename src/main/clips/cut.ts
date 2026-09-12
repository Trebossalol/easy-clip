import fs from "node:fs";
import path from "node:path";
import { shell } from "electron";
import { exportGifToFile } from "../../shared/clip-service.js";
import {
  cutClipOverwrite,
  cutClipToNewFile,
} from "../../shared/clips/index.js";
import { uniquePath } from "../../shared/clips/files.js";
import { findClip } from "../../shared/clips/store.js";
import type {
  CutClipResult,
  CutRange,
  ExportGifResult,
  ScaleTarget,
} from "../../shared/ipc.js";
import { getAppDataDir, getConfig } from "../session.js";
import { sendClipsChanged } from "./notify.js";
import { withClipUrls } from "./urls.js";

let cutting = false;
let exportingGif = false;

export async function runCutClip(
  id: string,
  ranges: CutRange[],
  overwrite?: boolean,
  scale?: ScaleTarget | null,
  name?: string | null,
): Promise<CutClipResult> {
  if (cutting) {
    return { ok: false, error: "Ein Clip wird bereits geschnitten." };
  }
  cutting = true;
  try {
    const options = {
      appDataDir: getAppDataDir(),
      outputDir: getConfig().CLIP_OUTPUT_DIR,
    };
    const result = overwrite
      ? await cutClipOverwrite(options, id, ranges, scale, name)
      : await cutClipToNewFile(options, id, ranges, scale, name);
    if (result.ok) {
      sendClipsChanged();
      return { ok: true, clip: withClipUrls([result.clip])[0]! };
    }
    return result;
  } finally {
    cutting = false;
  }
}

export async function runExportGif(
  id: string,
  ranges: CutRange[],
): Promise<ExportGifResult> {
  if (exportingGif) {
    return { ok: false, error: "Ein GIF wird bereits erstellt." };
  }
  exportingGif = true;
  try {
    const clip = findClip(getAppDataDir(), id);
    if (!clip) return { ok: false, error: "Clip nicht gefunden." };
    if (!clip.filePath || !fs.existsSync(clip.filePath)) {
      return { ok: false, error: "Die Clip-Datei fehlt." };
    }

    const dir = path.dirname(clip.filePath);
    const stem = path.basename(clip.filePath, path.extname(clip.filePath));
    const dest = uniquePath(dir, stem, ".gif");

    await exportGifToFile(clip.filePath, dest, ranges);
    shell.showItemInFolder(dest);
    return { ok: true, outputPath: dest };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  } finally {
    exportingGif = false;
  }
}
