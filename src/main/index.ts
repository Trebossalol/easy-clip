/**
 * Electron main-process entry.
 *
 * Domain logic lives next to this file:
 *   windows/  BrowserWindows (library, cutter, quick-action)
 *   obs/      OBS process + WebSocket
 *   clips/    create/cut, folder watch, renderer URLs
 *   protocol  thumb:// and media://
 *   ipc.ts    renderer bridge
 */
import fs from "node:fs";
import { join } from "node:path";
import { app, BrowserWindow, Menu } from "electron";
import { APP_ID, APP_NAME, APP_USER_MODEL_ID } from "../shared/app.config.js";
import { scanAndImportExisting } from "../shared/clips/index.js";
import { parseClipSecondsArg } from "../shared/paths.js";
import { setAppAutostartEnabled, shouldRunAutostart } from "./autostart.js";
import {
  getPendingClipSeconds,
  isAppReadyForClip,
  markAppReadyForClip,
  setPendingClipSeconds,
} from "./clip-args.js";
import {
  flushPendingClip,
  handleClipArg,
  sendClipsChanged,
  startFolderWatcher,
  stopFolderWatcher,
} from "./clips/index.js";
import { syncPresetHotkeys } from "./hotkey-actions.js";
import { unregisterAppHotkeys } from "./hotkeys.js";
import { registerIpc } from "./ipc.js";
import {
  beginIntentionalDisconnect,
  connectObs,
  disconnectObsSocketBestEffort,
  ensureReplayBufferStarted,
  obsState,
  refreshObsProcessRunning,
  startObsClipMode,
  startObsProcessPoll,
  stopObsProcessPoll,
} from "./obs/index.js";
import {
  registerMediaProtocolHandlers,
  registerPrivilegedSchemes,
} from "./protocol.js";
import { getConfig, getAppDataDir, initSession } from "./session.js";
import { scheduleUpdateCheck } from "./updates.js";
import {
  createAppTray,
  destroyTray,
  markAppQuitting,
  setTrayAppDataDir,
} from "./tray.js";
import {
  closeQuickActionWindow,
  createMainWindow,
  getMainWindow,
  showMainWindow,
  closeConfirmWindow,
} from "./windows/index.js";

registerPrivilegedSchemes();

app.setName(APP_NAME);
app.setAppUserModelId(APP_USER_MODEL_ID);
{
  const dir = join(app.getPath("appData"), APP_ID);
  app.setPath("userData", dir);
  app.setPath("sessionData", dir);
  const legacy = join(app.getPath("appData"), APP_NAME);
  if (legacy !== dir) {
    try {
      fs.rmSync(legacy, { recursive: true, force: true });
    } catch {
      // Previous runs used the display name as userData (Chromium cache).
    }
  }
}

const pendingClipAtLaunch = getPendingClipSeconds();
const gotSingleInstanceLock = app.requestSingleInstanceLock(
  pendingClipAtLaunch != null ? { clipSeconds: pendingClipAtLaunch } : {},
);

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine) => {
    const seconds = parseClipSecondsArg(commandLine);
    if (seconds != null) {
      if (isAppReadyForClip()) {
        void handleClipArg(seconds);
      } else {
        setPendingClipSeconds(seconds);
      }
      return;
    }
    if (app.isReady()) {
      showMainWindow();
    }
  });
}

app.whenReady().then(async () => {
  if (!gotSingleInstanceLock) return;

  const appDataDir = app.getPath("userData");
  initSession(appDataDir);
  setTrayAppDataDir(appDataDir);
  registerMediaProtocolHandlers();

  const config = getConfig();
  try {
    setAppAutostartEnabled(config.AUTOSTART, appDataDir);
  } catch {
    // Login-item registry may be locked; settings can retry.
  }
  registerIpc();
  Menu.setApplicationMenu(null);
  createMainWindow();
  scheduleUpdateCheck();
  syncPresetHotkeys(false);
  createAppTray({
    getWindow: getMainWindow,
    createWindow: createMainWindow,
  });
  startFolderWatcher();
  await scanAndImportExisting({
    appDataDir: getAppDataDir(),
    outputDir: config.CLIP_OUTPUT_DIR,
  });
  sendClipsChanged();
  await refreshObsProcessRunning();
  startObsProcessPoll();
  if (shouldRunAutostart(config.AUTOSTART) && !obsState.processRunning) {
    await startObsClipMode();
  }
  await connectObs();
  if (shouldRunAutostart(config.AUTOSTART)) {
    await ensureReplayBufferStarted();
  }

  markAppReadyForClip();
  flushPendingClip();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  // Keep the process alive in the system tray on Windows/Linux.
});

app.on("before-quit", () => {
  markAppQuitting();
  beginIntentionalDisconnect();
  unregisterAppHotkeys();
  closeQuickActionWindow();
  closeConfirmWindow();
  stopObsProcessPoll();
  destroyTray();
  void stopFolderWatcher();
  void disconnectObsSocketBestEffort();
});
