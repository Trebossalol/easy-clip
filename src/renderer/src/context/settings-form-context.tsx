import { createContext, useContext, type ReactNode } from "react";
import type { ClipPreset, ClipRecord, TagRecord } from "@shared/ipc";
import type { PresetDraft } from "@/components/settings/presets";

export interface SettingsFormValue {
  // OBS
  obsUrl: string;
  obsPassword: string;
  obsExePath: string;
  obsScene: string;
  obsReplayMinutes: string;
  obsReplaySeconds: string;
  replayInvalid: boolean;
  showPassword: boolean;
  onObsUrlChange: (value: string) => void;
  onObsPasswordChange: (value: string) => void;
  onObsExePathChange: (value: string) => void;
  onBrowseObsExe: () => void;
  onObsSceneChange: (value: string) => void;
  onObsReplayMinutesChange: (value: string) => void;
  onObsReplaySecondsChange: (value: string) => void;
  onTogglePassword: () => void;

  // Storage
  outputDir: string;
  onOutputDirChange: (value: string) => void;
  onBrowseOutputDir: () => void;
  obsRecordDirectory: string | null;
  outputDirMismatch: boolean;
  onAdoptObsOutputDir: () => Promise<void>;

  // Presets
  clipPresets: PresetDraft[];
  maxSeconds: number | null;
  quickActionHotkey: string | null;
  onQuickActionHotkeyChange: (hotkey: string | null) => void;
  onGoToObsSettings: () => void;
  onUpdatePreset: (
    id: number,
    field: "minutes" | "seconds",
    value: string,
  ) => void;
  onUpdatePresetHotkey: (id: number, hotkey: string | null) => void;
  onMovePreset: (index: number, direction: -1 | 1) => void;
  onAddPreset: () => void;
  onRemovePreset: (id: number) => void;
  onResetPresets: (values: ClipPreset[]) => void;

  // Autostart
  autostart: boolean;
  onAutostartChange: (value: boolean) => void;
  autostartAvailable: boolean | null;

  // About
  checkForUpdates: boolean;
  onCheckForUpdatesChange: (value: boolean) => void;

  // Tags
  tags: TagRecord[];
  clips: ClipRecord[];
}

const SettingsFormContext = createContext<SettingsFormValue | null>(null);

export function SettingsFormProvider({
  value,
  children,
}: {
  value: SettingsFormValue;
  children: ReactNode;
}) {
  return (
    <SettingsFormContext.Provider value={value}>
      {children}
    </SettingsFormContext.Provider>
  );
}

export function useSettingsForm(): SettingsFormValue {
  const context = useContext(SettingsFormContext);
  if (!context) {
    throw new Error("useSettingsForm must be used within a SettingsFormProvider.");
  }
  return context;
}
