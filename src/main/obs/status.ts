import { getObsRecordDirectory, pathsEqual } from "../../shared/obs.js";
import { IpcChannels, type ObsStatus } from "../../shared/ipc.js";
import { getConfig } from "../session.js";
import { mainAndQuickActionWindows } from "../windows/broadcast.js";
import { getObsSocket, obsState } from "./state.js";

export function currentObsStatus(): ObsStatus {
  const recordDirectory = obsState.connected ? obsState.recordDirectory : null;
  const outputDir = getConfig().CLIP_OUTPUT_DIR;
  const outputDirMismatch =
    obsState.connected &&
    recordDirectory != null &&
    recordDirectory.length > 0 &&
    !pathsEqual(recordDirectory, outputDir);

  return {
    connected: obsState.connected,
    running: obsState.connected || obsState.processRunning,
    error: obsState.error,
    replayBufferActive: obsState.connected ? obsState.replayBufferActive : false,
    replayMaxSeconds: obsState.connected ? obsState.replayMaxSeconds : null,
    currentScene: obsState.connected ? obsState.currentProgramScene : null,
    recordDirectory,
    outputDirMismatch,
  };
}

export function sendObsStatus(): void {
  const status = currentObsStatus();
  for (const win of mainAndQuickActionWindows()) {
    win.webContents.send(IpcChannels.obsStatusChanged, status);
  }
}

export async function refreshRecordDirectory(): Promise<boolean> {
  if (!obsState.connected) {
    const changed = obsState.recordDirectory != null;
    obsState.recordDirectory = null;
    return changed;
  }
  try {
    const next = await getObsRecordDirectory(getObsSocket());
    const changed = next !== obsState.recordDirectory;
    obsState.recordDirectory = next;
    return changed;
  } catch {
    const changed = obsState.recordDirectory != null;
    obsState.recordDirectory = null;
    return changed;
  }
}

export function resetObsRuntimeState(): void {
  obsState.connected = false;
  obsState.replayBufferActive = false;
  obsState.replayMaxSeconds = null;
  obsState.currentProgramScene = null;
  obsState.recordDirectory = null;
}
