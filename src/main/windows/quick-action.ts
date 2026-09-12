import { app, BrowserWindow, screen } from "electron";
import { APP_NAME } from "../../shared/app.config.js";
import { IpcChannels } from "../../shared/ipc.js";
import { isAppQuitting } from "../tray.js";
import { getAppIcon } from "../tray-icon.js";
import { loadRenderer, windowPrefs } from "./load.js";
import { getQuickActionWindow, setQuickActionWindow } from "./state.js";

const QUICK_ACTION_WIDTH = 360;
const QUICK_ACTION_HEIGHT = 560;

let ignoreQuickActionBlur = false;

export function hideQuickActionWindow(): void {
  const win = getQuickActionWindow();
  if (!win || win.isDestroyed()) return;
  if (win.isVisible()) win.hide();
}

function positionQuickActionWindow(win: BrowserWindow): void {
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const { x, y, width, height } = display.workArea;
  win.setPosition(
    Math.round(x + (width - QUICK_ACTION_WIDTH) / 2),
    Math.round(y + height * 0.22),
  );
}

function presentQuickActionWindow(win: BrowserWindow): void {
  ignoreQuickActionBlur = true;
  positionQuickActionWindow(win);
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.show();
  win.moveTop();
  win.focus();
  win.webContents.focus();
  app.focus({ steal: true });
  if (!win.isDestroyed()) {
    win.webContents.send(IpcChannels.quickActionOpened);
  }
  setTimeout(() => {
    ignoreQuickActionBlur = false;
  }, 350);
}

function createQuickActionWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: QUICK_ACTION_WIDTH,
    height: QUICK_ACTION_HEIGHT,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    show: false,
    focusable: true,
    hasShadow: true,
    backgroundColor: "#00000000",
    title: APP_NAME,
    icon: getAppIcon(),
    webPreferences: { ...windowPrefs },
  });
  loadRenderer(win, "quick");
  win.on("blur", () => {
    if (ignoreQuickActionBlur || isAppQuitting()) return;
    hideQuickActionWindow();
  });
  win.on("close", (event) => {
    if (!isAppQuitting()) {
      event.preventDefault();
      hideQuickActionWindow();
    }
  });
  win.on("closed", () => {
    if (getQuickActionWindow() === win) setQuickActionWindow(null);
  });
  return win;
}

export function toggleQuickActionWindow(): void {
  const existing = getQuickActionWindow();
  if (existing && !existing.isDestroyed()) {
    if (existing.isVisible()) {
      hideQuickActionWindow();
      return;
    }
    presentQuickActionWindow(existing);
    return;
  }
  const win = createQuickActionWindow();
  setQuickActionWindow(win);
  win.once("ready-to-show", () => {
    const current = getQuickActionWindow();
    if (!current || current.isDestroyed()) return;
    presentQuickActionWindow(current);
  });
}

export function closeQuickActionWindow(): void {
  const win = getQuickActionWindow();
  if (win && !win.isDestroyed()) {
    win.close();
  }
}
