import { IpcChannels, type HotkeyClipPayload } from "../shared/ipc.js";
import { runCreateClip } from "./clips/create.js";
import { registerAppHotkeys } from "./hotkeys.js";
import { getConfig } from "./session.js";
import {
  sendToMainWindow,
  showClipConfirmOverlay,
  toggleQuickActionWindow,
  windowCanShowToast,
} from "./windows/index.js";

export function syncPresetHotkeys(notify: boolean): string[] {
  const config = getConfig();
  const failed = registerAppHotkeys({
    presets: config.CLIP_PRESETS,
    quickActionHotkey: config.QUICK_ACTION_HOTKEY,
    onClip: (seconds) => {
      void handlePresetHotkey(seconds);
    },
    onQuickAction: () => {
      toggleQuickActionWindow();
    },
  });
  if (notify && failed.length > 0) {
    sendToMainWindow(IpcChannels.hotkeysFailed, failed);
  }
  return failed;
}

export async function handlePresetHotkey(
  seconds: number,
  title?: string,
  tagIds?: string[],
): Promise<void> {
  const result = await runCreateClip(seconds, { log: true, title, tagIds });
  const payload: HotkeyClipPayload = { seconds, result, title, tagIds };
  sendToMainWindow(IpcChannels.hotkeyClip, payload);
  if (windowCanShowToast()) return;
  showClipConfirmOverlay({
    ok: result.ok,
    seconds,
    title,
    error: result.ok ? undefined : result.error,
  });
}
