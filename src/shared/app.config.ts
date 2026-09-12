/** Compile-time app identity and defaults. User settings live in AppData (`config.ts`). */

/** Display name (UI, tray, window title, shortcuts). */
export const APP_NAME = "Easy Clip";

/** Public author name shown on the About page. */
export const APP_AUTHOR = "Trebossa";

/** `owner/repo` for GitHub Releases API checks. */
export const APP_GITHUB_REPO = "Trebossalol/easy-clip" as const;

/** Source repository opened from the About page. */
export const APP_GITHUB_URL = `https://github.com/${APP_GITHUB_REPO}`;

/** Product id (exe, AppData folder, installer artifacts). */
export const APP_ID = "EasyClip";

export const APP_USER_MODEL_ID = "com.easyclip.app";

export const MIN_CLIP_PRESET_SECONDS = 5;
export const MAX_CLIP_PRESETS = 6;
export const DEFAULT_CLIP_PRESETS = [30, 60, 300, 600] as const;

/** OBS Replay Buffer "Maximum Replay Time" (`RecRBTime`). */
export const MIN_OBS_REPLAY_SECONDS = 5;
export const MAX_OBS_REPLAY_SECONDS = 7200;

export const MIN_CUT_RANGE_SECONDS = 0.2;

/** x264 CRF when the cutter re-encodes a downscale (`scaleVideoToFile`). */
export const DOWNSCALE_CRF = 18;

export const DEFAULT_USER_CONFIG = {
  OBS_URL: "ws://localhost:4455",
  OBS_PASSWORD: "CHANGE_ME",
  OBS_SCENE: "",
  OBS_REPLAY_SECONDS: null as number | null,
  /** Empty = auto-detect `obs64.exe` under Program Files. */
  OBS_EXE_PATH: "",
  CLIP_OUTPUT_DIR: "C:\\Clips",
  AUTOSTART: false,
  CHECK_FOR_UPDATES: true,
  CLIP_PRESETS: DEFAULT_CLIP_PRESETS.map((seconds) => ({
    seconds,
    hotkey: null as string | null,
  })),
  QUICK_ACTION_HOTKEY: null as string | null,
};
