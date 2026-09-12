import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import {
  IpcChannels,
  type AppConfigDto,
  type ClipRecord,
  type CreateClipResult,
  type CutClipResult,
  type CutRange,
  type ScaleTarget,
  type ElectronApi,
  type ExportGifResult,
  type HotkeyClipPayload,
  type ClipConfirmPayload,
  type ObsScenesResult,
  type ObsStatus,
  type RenameClipResult,
  type SetClipTagsResult,
  type StorageInfoResult,
  type TagRecord,
  type TagResult,
  type AppUpdateInfo,
  type CheckForUpdatesResult,
} from "../shared/ipc.js";

const api: ElectronApi = {
  getConfig: () => ipcRenderer.invoke(IpcChannels.getConfig),
  saveConfig: (config: AppConfigDto) =>
    ipcRenderer.invoke(IpcChannels.saveConfig, config),
  pickOutputDir: () => ipcRenderer.invoke(IpcChannels.pickOutputDir),
  pickObsExe: () => ipcRenderer.invoke(IpcChannels.pickObsExe),
  getObsStatus: () => ipcRenderer.invoke(IpcChannels.getObsStatus),
  getObsScenes: (): Promise<ObsScenesResult> =>
    ipcRenderer.invoke(IpcChannels.getObsScenes),
  onObsStatus: (callback: (status: ObsStatus) => void) => {
    const listener = (_event: IpcRendererEvent, status: ObsStatus): void => {
      callback(status);
    };
    ipcRenderer.on(IpcChannels.obsStatusChanged, listener);
    return () => {
      ipcRenderer.removeListener(IpcChannels.obsStatusChanged, listener);
    };
  },
  createClip: (seconds: number): Promise<CreateClipResult> =>
    ipcRenderer.invoke(IpcChannels.createClip, seconds),
  listClips: () => ipcRenderer.invoke(IpcChannels.listClips),
  onClipsChanged: (callback: (clips: ClipRecord[]) => void) => {
    const listener = (_event: IpcRendererEvent, clips: ClipRecord[]): void => {
      callback(clips);
    };
    ipcRenderer.on(IpcChannels.clipsChanged, listener);
    return () => {
      ipcRenderer.removeListener(IpcChannels.clipsChanged, listener);
    };
  },
  renameClip: (id: string, name: string): Promise<RenameClipResult> =>
    ipcRenderer.invoke(IpcChannels.renameClip, id, name),
  setClipTags: (id: string, tagIds: string[]): Promise<SetClipTagsResult> =>
    ipcRenderer.invoke(IpcChannels.setClipTags, id, tagIds),
  deleteClip: (id: string) => ipcRenderer.invoke(IpcChannels.deleteClip, id),
  listTags: (): Promise<TagRecord[]> => ipcRenderer.invoke(IpcChannels.listTags),
  createTag: (name: string): Promise<TagResult> =>
    ipcRenderer.invoke(IpcChannels.createTag, name),
  renameTag: (id: string, name: string): Promise<TagResult> =>
    ipcRenderer.invoke(IpcChannels.renameTag, id, name),
  deleteTag: (id: string) => ipcRenderer.invoke(IpcChannels.deleteTag, id),
  onTagsChanged: (callback: (tags: TagRecord[]) => void) => {
    const listener = (_event: IpcRendererEvent, tags: TagRecord[]): void => {
      callback(tags);
    };
    ipcRenderer.on(IpcChannels.tagsChanged, listener);
    return () => {
      ipcRenderer.removeListener(IpcChannels.tagsChanged, listener);
    };
  },
  cutClip: (
    id: string,
    ranges: CutRange[],
    overwrite?: boolean,
    scale?: ScaleTarget | null,
    name?: string | null,
  ): Promise<CutClipResult> =>
    ipcRenderer.invoke(IpcChannels.cutClip, id, ranges, overwrite, scale, name),
  exportGif: (id: string, ranges: CutRange[]): Promise<ExportGifResult> =>
    ipcRenderer.invoke(IpcChannels.exportGif, id, ranges),
  getClip: (id: string) => ipcRenderer.invoke(IpcChannels.getClip, id),
  openCutter: (id?: string) => ipcRenderer.invoke(IpcChannels.openCutter, id),
  onCutterOpenClip: (callback: (id: string) => void) => {
    const listener = (_event: IpcRendererEvent, id: string): void => {
      callback(id);
    };
    ipcRenderer.on(IpcChannels.cutterOpenClip, listener);
    return () => {
      ipcRenderer.removeListener(IpcChannels.cutterOpenClip, listener);
    };
  },
  openClip: (id: string) => ipcRenderer.invoke(IpcChannels.openClip, id),
  revealClip: (id: string) => ipcRenderer.invoke(IpcChannels.revealClip, id),
  getStorage: (): Promise<StorageInfoResult> =>
    ipcRenderer.invoke(IpcChannels.getStorage),
  startObs: () => ipcRenderer.invoke(IpcChannels.startObs),
  stopObs: () => ipcRenderer.invoke(IpcChannels.stopObs),
  onHotkeysFailed: (callback: (accelerators: string[]) => void) => {
    const listener = (
      _event: IpcRendererEvent,
      accelerators: string[],
    ): void => {
      callback(accelerators);
    };
    ipcRenderer.on(IpcChannels.hotkeysFailed, listener);
    return () => {
      ipcRenderer.removeListener(IpcChannels.hotkeysFailed, listener);
    };
  },
  onHotkeyClip: (callback: (payload: HotkeyClipPayload) => void) => {
    const listener = (
      _event: IpcRendererEvent,
      payload: HotkeyClipPayload,
    ): void => {
      callback(payload);
    };
    ipcRenderer.on(IpcChannels.hotkeyClip, listener);
    return () => {
      ipcRenderer.removeListener(IpcChannels.hotkeyClip, listener);
    };
  },
  onQuickActionOpened: (callback: () => void) => {
    const listener = (): void => {
      callback();
    };
    ipcRenderer.on(IpcChannels.quickActionOpened, listener);
    return () => {
      ipcRenderer.removeListener(IpcChannels.quickActionOpened, listener);
    };
  },
  onClipConfirm: (callback: (payload: ClipConfirmPayload) => void) => {
    const listener = (
      _event: IpcRendererEvent,
      payload: ClipConfirmPayload,
    ): void => {
      callback(payload);
    };
    ipcRenderer.on(IpcChannels.clipConfirm, listener);
    return () => {
      ipcRenderer.removeListener(IpcChannels.clipConfirm, listener);
    };
  },
  closeQuickAction: () => ipcRenderer.invoke(IpcChannels.closeQuickAction),
  selectQuickAction: (seconds: number, title?: string, tagIds?: string[]) =>
    ipcRenderer.invoke(IpcChannels.selectQuickAction, seconds, title, tagIds),
  openExternal: (url: string) =>
    ipcRenderer.invoke(IpcChannels.openExternal, url),
  isPackaged: () => ipcRenderer.invoke(IpcChannels.isPackaged),
  getVersion: () => ipcRenderer.invoke(IpcChannels.getVersion),
  checkForUpdates: (): Promise<CheckForUpdatesResult> =>
    ipcRenderer.invoke(IpcChannels.checkForUpdates),
  onUpdateAvailable: (callback: (update: AppUpdateInfo) => void) => {
    const listener = (
      _event: IpcRendererEvent,
      update: AppUpdateInfo,
    ): void => {
      callback(update);
    };
    ipcRenderer.on(IpcChannels.updateAvailable, listener);
    return () => {
      ipcRenderer.removeListener(IpcChannels.updateAvailable, listener);
    };
  },
};

contextBridge.exposeInMainWorld("api", api);
