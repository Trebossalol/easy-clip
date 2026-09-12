import { listClips } from "../../shared/clips/index.js";
import { IpcChannels } from "../../shared/ipc.js";
import { listTags } from "../../shared/tags/store.js";
import { getAppDataDir } from "../session.js";
import { updateTrayBadge } from "../tray.js";
import {
  getMainWindow,
  getCutterWindow,
  getQuickActionWindow,
} from "../windows/state.js";
import { livingWindows, mainAndCutterWindows } from "../windows/broadcast.js";
import { withClipUrls } from "./urls.js";

export function sendTagsChanged(): void {
  const payload = listTags(getAppDataDir());
  for (const win of livingWindows(
    getMainWindow(),
    getCutterWindow(),
    getQuickActionWindow(),
  )) {
    win.webContents.send(IpcChannels.tagsChanged, payload);
  }
}

export function sendClipsChanged(): void {
  const payload = withClipUrls(listClips(getAppDataDir()));
  for (const win of mainAndCutterWindows()) {
    win.webContents.send(IpcChannels.clipsChanged, payload);
  }
  updateTrayBadge();
}

export function sendLibraryChanged(): void {
  sendTagsChanged();
  sendClipsChanged();
}
