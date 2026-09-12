import { OBSWebSocket } from "obs-websocket-js";
import { obsWebSocketUrls } from "../../shared/obs.js";
import { getConfig } from "../session.js";
import { sleep } from "../util.js";
import { refreshObsProcessRunning } from "./process.js";
import {
  applyConfiguredReplayMaxSeconds,
  refreshReplayBuffer,
  refreshReplayMaxSeconds,
} from "./replay.js";
import { refreshProgramScene } from "./scenes.js";
import { sendObsStatus, refreshRecordDirectory } from "./status.js";
import { obsState } from "./state.js";

export async function waitForObsConnected(timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (obsState.connected) return true;
    await sleep(250);
  }
  return obsState.connected;
}

export async function disconnectObs(): Promise<void> {
  obsState.intentionalDisconnect = true;
  obsState.connectGen += 1;
  obsState.connecting = false;
  if (obsState.reconnectTimer) {
    clearTimeout(obsState.reconnectTimer);
    obsState.reconnectTimer = null;
  }
  try {
    await obsState.socket.disconnect();
  } catch {
    // ignore
  }
  obsState.connected = false;
}

function scheduleReconnect(): void {
  if (obsState.reconnectTimer || obsState.intentionalDisconnect) return;
  const delay = Math.min(30_000, 1000 * 2 ** obsState.reconnectAttempt);
  obsState.reconnectAttempt += 1;
  obsState.reconnectTimer = setTimeout(() => {
    obsState.reconnectTimer = null;
    void connectObs();
  }, delay);
}

function attachObsSocketListeners(socket: OBSWebSocket): void {
  socket.on("ConnectionClosed", () => {
    if (socket !== obsState.socket || obsState.connecting) return;
    const wasConnected = obsState.connected;
    obsState.connected = false;
    if (wasConnected) {
      obsState.error = "Verbindung zu OBS getrennt";
    }
    obsState.replayBufferActive = false;
    obsState.replayMaxSeconds = null;
    obsState.currentProgramScene = null;
    obsState.recordDirectory = null;
    sendObsStatus();
    void refreshObsProcessRunning();
    if (!obsState.intentionalDisconnect) scheduleReconnect();
  });
  socket.on("ReplayBufferStateChanged", (event) => {
    if (socket !== obsState.socket) return;
    obsState.replayBufferActive = Boolean(event.outputActive);
    sendObsStatus();
  });
  socket.on("CurrentProgramSceneChanged", (event) => {
    if (socket !== obsState.socket) return;
    obsState.currentProgramScene = event.sceneName ?? null;
    sendObsStatus();
  });
  socket.on("CurrentProfileChanged", () => {
    if (socket !== obsState.socket) return;
    void Promise.all([refreshReplayMaxSeconds(), refreshRecordDirectory()]).then(
      ([maxChanged, dirChanged]) => {
        if (maxChanged || dirChanged) sendObsStatus();
      },
    );
  });
  socket.on("ConnectionError", (err) => {
    if (socket !== obsState.socket || obsState.connecting) return;
    obsState.connected = false;
    obsState.error = err instanceof Error ? err.message : String(err);
    obsState.replayBufferActive = false;
    obsState.replayMaxSeconds = null;
    obsState.currentProgramScene = null;
    obsState.recordDirectory = null;
    sendObsStatus();
  });
}

async function connectObsSocket(
  socket: OBSWebSocket,
  url: string,
  password: string,
  timeoutMs = 5000,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      socket.connect(url, password),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error("Zeitüberschreitung bei der OBS-Verbindung"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function requestObsReconnect(): void {
  obsState.intentionalDisconnect = false;
  obsState.reconnectAttempt = 0;
  if (obsState.reconnectTimer) {
    clearTimeout(obsState.reconnectTimer);
    obsState.reconnectTimer = null;
  }
  if (!obsState.connected) void connectObs();
}

export function markObsLaunchRequested(): void {
  obsState.processRunning = true;
  sendObsStatus();
  requestObsReconnect();
}

export async function connectObs(): Promise<void> {
  const gen = ++obsState.connectGen;
  obsState.intentionalDisconnect = false;
  if (obsState.reconnectTimer) {
    clearTimeout(obsState.reconnectTimer);
    obsState.reconnectTimer = null;
  }

  obsState.connecting = true;
  try {
    try {
      await obsState.socket.disconnect();
    } catch {
      // ignore
    }
    if (gen !== obsState.connectGen) return;

    const config = getConfig();
    let lastError: unknown;
    for (const url of obsWebSocketUrls(config.OBS_URL)) {
      if (gen !== obsState.connectGen) return;
      const socket = new OBSWebSocket();
      attachObsSocketListeners(socket);
      obsState.socket = socket;
      try {
        await connectObsSocket(socket, url, config.OBS_PASSWORD);
        if (gen !== obsState.connectGen || socket !== obsState.socket) {
          try {
            await socket.disconnect();
          } catch {
            // superseded
          }
          return;
        }
        obsState.connected = true;
        obsState.processRunning = true;
        obsState.error = undefined;
        obsState.reconnectAttempt = 0;
        await refreshReplayBuffer();
        await refreshReplayMaxSeconds();
        await applyConfiguredReplayMaxSeconds();
        await refreshProgramScene();
        await refreshRecordDirectory();
        sendObsStatus();
        return;
      } catch (err) {
        lastError = err;
        try {
          await socket.disconnect();
        } catch {
          // ignore
        }
      }
    }

    if (gen !== obsState.connectGen) return;
    obsState.connected = false;
    obsState.error =
      lastError instanceof Error ? lastError.message : String(lastError);
    sendObsStatus();
    void refreshObsProcessRunning();
    obsState.connecting = false;
    scheduleReconnect();
  } finally {
    if (gen === obsState.connectGen) obsState.connecting = false;
  }
}

export function beginIntentionalDisconnect(): void {
  obsState.intentionalDisconnect = true;
}

export async function disconnectObsSocketBestEffort(): Promise<void> {
  try {
    await obsState.socket.disconnect();
  } catch {
    // ignore
  }
}
