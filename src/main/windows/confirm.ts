import { BrowserWindow, screen } from "electron";
import { APP_NAME } from "../../shared/app.config.js";
import { IpcChannels, type ClipConfirmPayload } from "../../shared/ipc.js";
import { isAppQuitting } from "../tray.js";
import { getAppIcon } from "../tray-icon.js";
import { loadRenderer, windowPrefs } from "./load.js";
import { getConfirmWindow, setConfirmWindow } from "./state.js";

const CONFIRM_WIDTH = 320;
const CONFIRM_HEIGHT = 72;
const CONFIRM_VISIBLE_MS = 2200;

let hideTimer: NodeJS.Timeout | null = null;

function clearHideTimer(): void {
  if (!hideTimer) return;
  clearTimeout(hideTimer);
  hideTimer = null;
}

export function hideConfirmWindow(): void {
  clearHideTimer();
  const win = getConfirmWindow();
  if (!win || win.isDestroyed()) return;
  if (win.isVisible()) win.hide();
}

function positionConfirmWindow(win: BrowserWindow): void {
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const { x, y, width } = display.workArea;
  win.setPosition(
    Math.round(x + (width - CONFIRM_WIDTH) / 2),
    Math.round(y + 24),
  );
}

function createConfirmWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: CONFIRM_WIDTH,
    height: CONFIRM_HEIGHT,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    show: false,
    focusable: false,
    hasShadow: false,
    backgroundColor: "#00000000",
    title: APP_NAME,
    icon: getAppIcon(),
    webPreferences: { ...windowPrefs },
  });
  loadRenderer(win, "confirm");
  win.setIgnoreMouseEvents(true);
  win.on("closed", () => {
    if (getConfirmWindow() === win) setConfirmWindow(null);
  });
  return win;
}

function presentConfirmWindow(win: BrowserWindow, payload: ClipConfirmPayload): void {
  clearHideTimer();
  positionConfirmWindow(win);
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true);
  // Never steal focus from the game.
  win.showInactive();
  win.moveTop();

  const send = (): void => {
    if (!win.isDestroyed()) {
      win.webContents.send(IpcChannels.clipConfirm, payload);
    }
  };
  send();
  // Renderer may still be mounting on first open — resend once.
  setTimeout(send, 80);

  hideTimer = setTimeout(() => {
    hideTimer = null;
    hideConfirmWindow();
  }, CONFIRM_VISIBLE_MS);
}

/** Show a click-through in-game chip. Returns true when shown. */
export function showClipConfirmOverlay(payload: ClipConfirmPayload): boolean {
  if (isAppQuitting()) return false;

  const existing = getConfirmWindow();
  if (existing && !existing.isDestroyed()) {
    presentConfirmWindow(existing, payload);
    return true;
  }

  const win = createConfirmWindow();
  setConfirmWindow(win);
  win.once("ready-to-show", () => {
    const current = getConfirmWindow();
    if (!current || current.isDestroyed()) return;
    presentConfirmWindow(current, payload);
  });
  return true;
}

export function closeConfirmWindow(): void {
  clearHideTimer();
  const win = getConfirmWindow();
  if (win && !win.isDestroyed()) {
    win.destroy();
  }
  setConfirmWindow(null);
}
