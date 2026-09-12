import type { OBSWebSocket } from "obs-websocket-js";
import path from "node:path";
import {
  MAX_OBS_REPLAY_SECONDS,
  MIN_OBS_REPLAY_SECONDS,
} from "./app.config.js";

/**
 * `localhost` often resolves to IPv6 `::1` on Windows while OBS listens on
 * IPv4 only — try `127.0.0.1` first, then the original URL.
 */
export function obsWebSocketUrls(url: string): string[] {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.toLowerCase() === "localhost") {
      const ipv4 = new URL(url);
      ipv4.hostname = "127.0.0.1";
      const rewritten = ipv4.toString();
      return rewritten === url ? [url] : [rewritten, url];
    }
  } catch {
    // keep the original string
  }
  return [url];
}

export function parseObsProfileSeconds(
  value: string | undefined | null,
): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function configuredReplaySeconds(
  value: number | undefined | null,
): number | null {
  if (value == null || !Number.isInteger(value)) return null;
  if (value < MIN_OBS_REPLAY_SECONDS || value > MAX_OBS_REPLAY_SECONDS) {
    return null;
  }
  return value;
}

async function obsReplayBufferCategory(
  obs: OBSWebSocket,
): Promise<"AdvOut" | "SimpleOutput"> {
  const modeRes = await obs.call("GetProfileParameter", {
    parameterCategory: "Output",
    parameterName: "Mode",
  });
  return modeRes.parameterValue === "Advanced" ? "AdvOut" : "SimpleOutput";
}

/** OBS "Maximum Replay Time" (`RecRBTime`) in seconds. */
export async function getObsReplayMaxSeconds(
  obs: OBSWebSocket,
): Promise<number | null> {
  const category = await obsReplayBufferCategory(obs);
  const timeRes = await obs.call("GetProfileParameter", {
    parameterCategory: category,
    parameterName: "RecRBTime",
  });
  return (
    parseObsProfileSeconds(timeRes.parameterValue) ??
    parseObsProfileSeconds(timeRes.defaultParameterValue)
  );
}

/** Writes Maximum Replay Time to both output modes so a later mode switch stays in sync. */
export async function setObsReplayMaxSeconds(
  obs: OBSWebSocket,
  seconds: number,
): Promise<void> {
  const value = String(seconds);
  for (const category of ["SimpleOutput", "AdvOut"] as const) {
    await obs.call("SetProfileParameter", {
      parameterCategory: category,
      parameterName: "RecRBTime",
      parameterValue: value,
    });
  }
}

export function configuredObsScene(scene: string | undefined | null): string | null {
  const trimmed = scene?.trim();
  return trimmed ? trimmed : null;
}

export async function getObsProgramScene(
  obs: OBSWebSocket,
): Promise<string | null> {
  const res = await obs.call("GetCurrentProgramScene");
  return res.currentProgramSceneName ?? null;
}

export async function listObsScenes(obs: OBSWebSocket): Promise<{
  names: string[];
  current: string | null;
}> {
  const res = await obs.call("GetSceneList");
  const names = res.scenes
    .map((scene) => scene.sceneName)
    .filter((name): name is string => typeof name === "string" && name.length > 0);
  return {
    names,
    current: res.currentProgramSceneName ?? null,
  };
}

export async function setObsProgramScene(
  obs: OBSWebSocket,
  sceneName: string,
): Promise<void> {
  await obs.call("SetCurrentProgramScene", { sceneName });
}

/** Normalize paths for folder equality checks (Windows-friendly). */
export function normalizeDirPath(value: string): string {
  const trimmed = value.trim().replace(/[/\\]+$/, "");
  if (!trimmed) return "";
  try {
    return path.resolve(trimmed).replace(/[/\\]+$/, "").toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

export function pathsEqual(a: string, b: string): boolean {
  const left = normalizeDirPath(a);
  const right = normalizeDirPath(b);
  return Boolean(left && right && left === right);
}

/**
 * OBS recording / replay output directory.
 * Prefers `GetRecordDirectory` (OBS 28+), then profile RecFilePath / FilePath.
 */
export async function getObsRecordDirectory(
  obs: OBSWebSocket,
): Promise<string | null> {
  try {
    const res = await obs.call("GetRecordDirectory");
    const dir = res.recordDirectory?.trim();
    if (dir) return dir;
  } catch {
    // Older builds or restricted profiles — fall through.
  }

  try {
    const category = await obsReplayBufferCategory(obs);
    const fileParam = category === "AdvOut" ? "RecFilePath" : "FilePath";
    const fileRes = await obs.call("GetProfileParameter", {
      parameterCategory: category,
      parameterName: fileParam,
    });
    const raw =
      fileRes.parameterValue?.trim() ||
      fileRes.defaultParameterValue?.trim() ||
      "";
    if (!raw) return null;
    // Simple output may store a filename template with path; take the directory.
    if (/\.(mp4|mkv|mov|flv|ts|m3u8)$/i.test(raw) || /%/.test(raw)) {
      return path.dirname(raw);
    }
    return raw;
  } catch {
    return null;
  }
}
