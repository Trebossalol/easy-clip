/**
 * BrowserWindow helpers: main library, cutter, quick-action, and confirm overlay.
 */
export {
  sendToMainWindow,
  windowCanShowToast,
} from "./broadcast.js";
export { openCutterWindow } from "./cutter.js";
export { createMainWindow, showMainWindow } from "./main.js";
export {
  closeQuickActionWindow,
  hideQuickActionWindow,
  toggleQuickActionWindow,
} from "./quick-action.js";
export {
  closeConfirmWindow,
  showClipConfirmOverlay,
} from "./confirm.js";
export { getMainWindow } from "./state.js";
