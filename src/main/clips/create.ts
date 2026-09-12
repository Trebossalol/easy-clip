import { saveAndTrimClip } from "../../shared/clip-service.js";
import {
  ignorePathTemporarily,
  importClipFromFile,
  removeClipByFilePath,
} from "../../shared/clips/index.js";
import type { CreateClipResult } from "../../shared/ipc.js";
import { createRunLog } from "../../shared/log.js";
import { validateClipSeconds } from "../../shared/paths.js";
import { takePendingClipSeconds } from "../clip-args.js";
import {
  applyClipScene,
  getObsSocket,
  obsState,
  refreshReplayMaxSeconds,
  waitForObsConnected,
} from "../obs/index.js";
import { getAppDataDir, getConfig } from "../session.js";
import { sendClipsChanged } from "./notify.js";

let clipping = false;

export async function runCreateClip(
  seconds: number,
  options?: { log?: boolean; title?: string; tagIds?: string[] },
): Promise<CreateClipResult> {
  const tooShort = validateClipSeconds(seconds);
  if (tooShort) return { ok: false, error: tooShort };
  const length = Math.floor(seconds);

  if (clipping) {
    return { ok: false, error: "Ein Clip wird bereits erstellt." };
  }
  if (!obsState.connected) {
    await waitForObsConnected();
  }
  if (!obsState.connected) {
    return { ok: false, error: "OBS-WebSocket ist nicht verbunden." };
  }

  const scene = await applyClipScene();
  if (!scene.ok) return scene;

  await refreshReplayMaxSeconds();
  const tooLong = validateClipSeconds(length, obsState.replayMaxSeconds);
  if (tooLong) return { ok: false, error: tooLong };

  const config = getConfig();
  const appDataDir = getAppDataDir();
  const log = options?.log ? createRunLog("clip") : undefined;
  log?.info(`Requested clip length: ${length}s`);
  log?.info(`CLIP_OUTPUT_DIR: ${config.CLIP_OUTPUT_DIR}`);

  clipping = true;
  try {
    const result = await saveAndTrimClip({
      obs: getObsSocket(),
      seconds: length,
      outputDir: config.CLIP_OUTPUT_DIR,
      log,
      onReplaySaved: (savedPath) => {
        ignorePathTemporarily(savedPath, 30_000);
      },
    });
    removeClipByFilePath(appDataDir, result.sourcePath);
    await importClipFromFile(
      { appDataDir, outputDir: config.CLIP_OUTPUT_DIR },
      result.outputPath,
      {
        durationSeconds: result.durationSeconds,
        name: options?.title,
        tagIds: options?.tagIds,
      },
    );
    sendClipsChanged();
    log?.info(`Done: ${result.outputPath}`);
    return { ok: true, outputPath: result.outputPath };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log?.error(`Error: ${message}`);
    return { ok: false, error: message };
  } finally {
    clipping = false;
  }
}

export function isClipping(): boolean {
  return clipping;
}

export async function handleClipArg(seconds: number): Promise<void> {
  const result = await runCreateClip(seconds, { log: true });
  if (!result.ok) {
    console.error(result.error);
  }
}

export function flushPendingClip(): void {
  const seconds = takePendingClipSeconds();
  if (seconds == null) return;
  void handleClipArg(seconds);
}
