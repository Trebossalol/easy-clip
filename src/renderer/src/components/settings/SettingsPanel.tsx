import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  MAX_CLIP_PRESETS,
  MAX_OBS_REPLAY_SECONDS,
  MIN_OBS_REPLAY_SECONDS,
} from "@shared/app.config";
import type {
  AppConfigDto,
  ClipPreset,
  ClipRecord,
  ObsStatus,
  TagRecord,
} from "@shared/ipc";
import { normalizeHotkey } from "@shared/hotkeys";
import { formatDuration } from "@/format";
import { SaveIcon } from "lucide-react";
import type { SettingsSection } from "@/components/AppSidebar";
import { AboutSection } from "@/components/settings/sections/about/AboutSection";
import { AutostartSection } from "@/components/settings/sections/autostart/AutostartSection";
import { ObsSection } from "@/components/settings/sections/obs/ObsSection";
import { PresetsSection } from "@/components/settings/sections/presets/PresetsSection";
import {
  SettingsFormProvider,
  type SettingsFormValue,
} from "@/context/settings-form-context";
import { StorageSection } from "@/components/settings/sections/storage/StorageSection";
import { TagsSection } from "@/components/settings/sections/tags/TagsSection";
import {
  collectClipPresets,
  draftsFromPresets,
  nextPresetSeconds,
  parseDurationParts,
  type PresetDraft,
} from "@/components/settings/presets";

function replayDraftFrom(total: number | null | undefined): {
  minutes: string;
  seconds: string;
} {
  if (total == null || total <= 0) return { minutes: "", seconds: "" };
  return {
    minutes: String(Math.floor(total / 60)),
    seconds: String(total % 60),
  };
}

function parseReplayBufferSeconds(
  minutes: string,
  seconds: string,
): { ok: true; seconds: number | null } | { ok: false; error: string } {
  const minEmpty = minutes.trim() === "";
  const secEmpty = seconds.trim() === "";
  if (minEmpty && secEmpty) return { ok: true, seconds: null };
  const minRaw = minEmpty ? 0 : Number(minutes);
  const secRaw = secEmpty ? 0 : Number(seconds);
  if (
    !Number.isFinite(minRaw) ||
    !Number.isFinite(secRaw) ||
    !Number.isInteger(minRaw) ||
    !Number.isInteger(secRaw) ||
    minRaw < 0 ||
    secRaw < 0 ||
    secRaw > 59
  ) {
    return { ok: false, error: "Ungültige Pufferdauer." };
  }
  const total = minRaw * 60 + secRaw;
  if (total < MIN_OBS_REPLAY_SECONDS || total > MAX_OBS_REPLAY_SECONDS) {
    return {
      ok: false,
      error: `Die Pufferdauer muss zwischen ${formatDuration(MIN_OBS_REPLAY_SECONDS)} und ${formatDuration(MAX_OBS_REPLAY_SECONDS)} liegen.`,
    };
  }
  return { ok: true, seconds: total };
}

interface SettingsPanelProps {
  section: SettingsSection;
  config: AppConfigDto;
  replayMaxSeconds: number | null;
  obsStatus: ObsStatus | null;
  onSave: (config: AppConfigDto) => Promise<AppConfigDto>;
  onGoToObsSettings: () => void;
  tags: TagRecord[];
  clips: ClipRecord[];
}

export function SettingsPanel({
  section,
  config,
  replayMaxSeconds,
  obsStatus,
  onSave,
  onGoToObsSettings,
  tags,
  clips,
}: SettingsPanelProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [obsUrl, setObsUrl] = useState(config.OBS_URL);
  const [obsPassword, setObsPassword] = useState(config.OBS_PASSWORD);
  const [obsExePath, setObsExePath] = useState(config.OBS_EXE_PATH ?? "");
  const [obsScene, setObsScene] = useState(config.OBS_SCENE);
  const replaySeeded = useRef(config.OBS_REPLAY_SECONDS != null);
  const initialReplay = replayDraftFrom(
    config.OBS_REPLAY_SECONDS ?? replayMaxSeconds,
  );
  const [obsReplayMinutes, setObsReplayMinutes] = useState(initialReplay.minutes);
  const [obsReplaySeconds, setObsReplaySeconds] = useState(initialReplay.seconds);
  const [outputDir, setOutputDir] = useState(config.CLIP_OUTPUT_DIR);
  const [autostart, setAutostart] = useState(config.AUTOSTART);
  const [checkForUpdates, setCheckForUpdates] = useState(
    config.CHECK_FOR_UPDATES,
  );
  const [quickActionHotkey, setQuickActionHotkey] = useState(
    config.QUICK_ACTION_HOTKEY,
  );
  const nextPresetId = useRef(1);
  const [clipPresets, setClipPresets] = useState<PresetDraft[]>(() => {
    const { drafts, nextId } = draftsFromPresets(
      config.CLIP_PRESETS,
      nextPresetId.current,
    );
    nextPresetId.current = nextId;
    return drafts;
  });
  const [saving, setSaving] = useState(false);
  const [packaged, setPackaged] = useState<boolean | null>(null);
  const maxSeconds =
    replayMaxSeconds != null && replayMaxSeconds > 0 ? replayMaxSeconds : null;

  useEffect(() => {
    let cancelled = false;
    void window.api.isPackaged().then((value) => {
      if (!cancelled) setPackaged(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setObsUrl(config.OBS_URL);
    setObsPassword(config.OBS_PASSWORD);
    setObsExePath(config.OBS_EXE_PATH ?? "");
    setObsScene(config.OBS_SCENE);
    if (config.OBS_REPLAY_SECONDS != null) {
      const fromConfig = replayDraftFrom(config.OBS_REPLAY_SECONDS);
      setObsReplayMinutes(fromConfig.minutes);
      setObsReplaySeconds(fromConfig.seconds);
      replaySeeded.current = true;
    }
    setOutputDir(config.CLIP_OUTPUT_DIR);
    setAutostart(config.AUTOSTART);
    setCheckForUpdates(config.CHECK_FOR_UPDATES);
    setQuickActionHotkey(config.QUICK_ACTION_HOTKEY);
    const { drafts, nextId } = draftsFromPresets(
      config.CLIP_PRESETS,
      nextPresetId.current,
    );
    nextPresetId.current = nextId;
    setClipPresets(drafts);
  }, [
    config.OBS_URL,
    config.OBS_PASSWORD,
    config.OBS_EXE_PATH,
    config.OBS_SCENE,
    config.OBS_REPLAY_SECONDS,
    config.CLIP_OUTPUT_DIR,
    config.AUTOSTART,
    config.CHECK_FOR_UPDATES,
    config.QUICK_ACTION_HOTKEY,
    config.CLIP_PRESETS,
  ]);

  useEffect(() => {
    if (replaySeeded.current) return;
    if (config.OBS_REPLAY_SECONDS != null) {
      replaySeeded.current = true;
      return;
    }
    if (replayMaxSeconds == null || replayMaxSeconds <= 0) return;
    replaySeeded.current = true;
    const live = replayDraftFrom(replayMaxSeconds);
    setObsReplayMinutes(live.minutes);
    setObsReplaySeconds(live.seconds);
  }, [config.OBS_REPLAY_SECONDS, replayMaxSeconds]);

  const handleBrowse = useCallback(async (): Promise<void> => {
    const dir = await window.api.pickOutputDir();
    if (dir) setOutputDir(dir);
  }, []);

  const adoptObsOutputDir = useCallback(async (): Promise<void> => {
    const dir = obsStatus?.recordDirectory?.trim();
    if (!dir) {
      toast.error("OBS-Aufnahmepfad ist unbekannt.");
      return;
    }
    setOutputDir(dir);
    try {
      const saved = await onSave({ ...config, CLIP_OUTPUT_DIR: dir });
      setOutputDir(saved.CLIP_OUTPUT_DIR);
      toast.success("Clip-Ausgabeordner an OBS angepasst.");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    }
  }, [config, obsStatus?.recordDirectory, onSave]);

  const handleBrowseObsExe = useCallback(async (): Promise<void> => {
    const exe = await window.api.pickObsExe();
    if (exe) setObsExePath(exe);
  }, []);

  const applyPresets = useCallback((values: ClipPreset[]): void => {
    const { drafts, nextId } = draftsFromPresets(
      values,
      nextPresetId.current,
    );
    nextPresetId.current = nextId;
    setClipPresets(drafts);
  }, []);

  const updatePreset = useCallback(
    (id: number, field: "minutes" | "seconds", value: string): void => {
      setClipPresets((rows) =>
        rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
      );
    },
    [],
  );

  const updatePresetHotkey = useCallback(
    (id: number, hotkey: string | null): void => {
      setClipPresets((rows) =>
        rows.map((row) => (row.id === id ? { ...row, hotkey } : row)),
      );
    },
    [],
  );

  const movePreset = useCallback(
    (index: number, direction: -1 | 1): void => {
      setClipPresets((rows) => {
        const next = index + direction;
        if (next < 0 || next >= rows.length) return rows;
        const copy = [...rows];
        const [item] = copy.splice(index, 1);
        if (!item) return rows;
        copy.splice(next, 0, item);
        return copy;
      });
    },
    [],
  );

  const addPreset = useCallback((): void => {
    setClipPresets((rows) => {
      if (rows.length >= MAX_CLIP_PRESETS) return rows;
      const existing = rows
        .map((row) => parseDurationParts(row.minutes, row.seconds, maxSeconds))
        .filter((n): n is number => n != null);
      const total = nextPresetSeconds(existing, maxSeconds);
      const id = nextPresetId.current++;
      return [
        ...rows,
        {
          id,
          minutes: String(Math.floor(total / 60)),
          seconds: String(total % 60),
          hotkey: null,
        },
      ];
    });
  }, [maxSeconds]);

  const removePreset = useCallback((id: number): void => {
    setClipPresets((rows) =>
      rows.length <= 1 ? rows : rows.filter((row) => row.id !== id),
    );
  }, []);

  const togglePassword = useCallback((): void => {
    setShowPassword((s) => !s);
  }, []);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    const next: AppConfigDto = { ...config };
    if (section === "obs") {
      next.OBS_URL = obsUrl.trim();
      next.OBS_PASSWORD = obsPassword;
      if (!next.OBS_URL) {
        toast.error("Bitte eine Server-Adresse eintragen.");
        return;
      }
      if (!next.OBS_PASSWORD) {
        toast.error("Bitte ein Passwort eintragen.");
        return;
      }
      next.OBS_EXE_PATH = (obsExePath ?? "").trim();
      next.OBS_SCENE = obsScene.trim();
      const replay = parseReplayBufferSeconds(obsReplayMinutes, obsReplaySeconds);
      if (!replay.ok) {
        toast.error(replay.error);
        return;
      }
      next.OBS_REPLAY_SECONDS = replay.seconds;
    } else if (section === "storage") {
      next.CLIP_OUTPUT_DIR = outputDir.trim();
    } else if (section === "presets") {
      const collected = collectClipPresets(clipPresets, maxSeconds);
      if (!collected.ok) {
        toast.error(collected.error);
        return;
      }
      next.CLIP_PRESETS = collected.values;
      const menuHotkey = quickActionHotkey
        ? normalizeHotkey(quickActionHotkey)
        : null;
      if (quickActionHotkey && !menuHotkey) {
        toast.error(
          "Ungültiges Tastenkürzel für das Schnellmenü. Mindestens Strg, Alt oder Windows plus eine Taste.",
        );
        return;
      }
      if (
        menuHotkey &&
        collected.values.some((preset) => preset.hotkey === menuHotkey)
      ) {
        toast.error(
          "Das Schnellmenü-Tastenkürzel ist schon einem Preset zugeordnet.",
        );
        return;
      }
      next.QUICK_ACTION_HOTKEY = menuHotkey;
    } else if (section === "autostart") {
      if (packaged !== true) return;
      next.AUTOSTART = autostart;
    } else if (section === "about") {
      next.CHECK_FOR_UPDATES = checkForUpdates;
    } else if (section === "tags") {
      return;
    } else {
      return;
    }
    setSaving(true);
    try {
      const saved = await onSave(next);
      setObsUrl(saved.OBS_URL);
      setObsPassword(saved.OBS_PASSWORD);
      setObsExePath(saved.OBS_EXE_PATH ?? "");
      setObsScene(saved.OBS_SCENE);
      const savedReplay = replayDraftFrom(saved.OBS_REPLAY_SECONDS);
      setObsReplayMinutes(savedReplay.minutes);
      setObsReplaySeconds(savedReplay.seconds);
      if (saved.OBS_REPLAY_SECONDS != null) replaySeeded.current = true;
      setOutputDir(saved.CLIP_OUTPUT_DIR);
      setAutostart(saved.AUTOSTART);
      setCheckForUpdates(saved.CHECK_FOR_UPDATES);
      setQuickActionHotkey(saved.QUICK_ACTION_HOTKEY);
      applyPresets(saved.CLIP_PRESETS);
      toast.success("Einstellungen gespeichert.");
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      toast.error(text);
    } finally {
      setSaving(false);
    }
  }

  const form = useMemo<SettingsFormValue>(
    () => ({
      obsUrl,
      obsPassword,
      obsExePath,
      obsScene,
      obsReplayMinutes,
      obsReplaySeconds,
      replayInvalid: !parseReplayBufferSeconds(obsReplayMinutes, obsReplaySeconds)
        .ok,
      showPassword,
      onObsUrlChange: setObsUrl,
      onObsPasswordChange: setObsPassword,
      onObsExePathChange: setObsExePath,
      onBrowseObsExe: () => void handleBrowseObsExe(),
      onObsSceneChange: setObsScene,
      onObsReplayMinutesChange: setObsReplayMinutes,
      onObsReplaySecondsChange: setObsReplaySeconds,
      onTogglePassword: togglePassword,

      outputDir,
      onOutputDirChange: setOutputDir,
      onBrowseOutputDir: () => void handleBrowse(),
      obsRecordDirectory: obsStatus?.recordDirectory ?? null,
      outputDirMismatch: obsStatus?.outputDirMismatch === true,
      onAdoptObsOutputDir: () => adoptObsOutputDir(),

      clipPresets,
      maxSeconds,
      quickActionHotkey,
      onQuickActionHotkeyChange: setQuickActionHotkey,
      onGoToObsSettings,
      onUpdatePreset: updatePreset,
      onUpdatePresetHotkey: updatePresetHotkey,
      onMovePreset: movePreset,
      onAddPreset: addPreset,
      onRemovePreset: removePreset,
      onResetPresets: applyPresets,

      autostart,
      onAutostartChange: setAutostart,
      autostartAvailable: packaged,

      checkForUpdates,
      onCheckForUpdatesChange: setCheckForUpdates,

      tags,
      clips,
    }),
    [
      obsUrl,
      obsPassword,
      obsExePath,
      obsScene,
      obsReplayMinutes,
      obsReplaySeconds,
      showPassword,
      handleBrowseObsExe,
      togglePassword,
      outputDir,
      handleBrowse,
      adoptObsOutputDir,
      obsStatus?.recordDirectory,
      obsStatus?.outputDirMismatch,
      clipPresets,
      maxSeconds,
      quickActionHotkey,
      onGoToObsSettings,
      updatePreset,
      updatePresetHotkey,
      movePreset,
      addPreset,
      removePreset,
      applyPresets,
      autostart,
      packaged,
      checkForUpdates,
      tags,
      clips,
    ],
  );

  return (
    <SettingsFormProvider value={form}>
      <form
        className="mx-auto flex min-h-full w-full max-w-200 flex-col px-5 pt-5"
        noValidate
        onSubmit={(e) => void handleSubmit(e)}
      >
        <div className="flex flex-1 flex-col gap-4 pb-4">
          {section === "obs" ? <ObsSection /> : null}
          {section === "storage" ? <StorageSection /> : null}
          {section === "tags" ? <TagsSection /> : null}
          {section === "presets" ? <PresetsSection /> : null}
          {section === "autostart" ? <AutostartSection /> : null}
          {section === "about" ? <AboutSection /> : null}
        </div>
        {section === "autostart" && packaged !== true ? null : section === "tags" ? null : (
          <div className="sticky bottom-0 z-10 -mx-5 mt-auto border-t border-white/10 bg-background/75 px-5 py-3 backdrop-blur-xl">
            <Button type="submit" disabled={saving}>
              <SaveIcon data-icon="inline-start" />
              Einstellungen speichern
            </Button>
          </div>
        )}
      </form>
    </SettingsFormProvider>
  );
}
