import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { formatDuration } from "@/format";
import { formatHotkey } from "@shared/hotkeys";
import type { ClipPreset, ObsStatus } from "@shared/ipc";
import { ClockIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  clipPresetsFromSeconds,
  getClipAvailability,
} from "@/components/ClipActions";
import { ObsStatusPill } from "@/components/settings/sections/obs/ObsStatusPill";
import { viewCopy, type AppView } from "@/components/AppSidebar";

interface AppHeaderProps {
  view: AppView;
  obsStatus: ObsStatus | null;
  busy: boolean;
  lastSeconds: number | null;
  clipPresets: ClipPreset[];
  clipScene?: string | null;
  onCreate: (seconds: number) => void;
  onGoToObsSettings: () => void;
}

export function AppHeader({
  view,
  obsStatus,
  busy,
  lastSeconds,
  clipPresets,
  clipScene,
  onCreate,
  onGoToObsSettings,
}: AppHeaderProps) {
  const copy = viewCopy(view);
  const connected = obsStatus?.connected === true;
  const presets = clipPresetsFromSeconds(
    clipPresets.map((preset) => preset.seconds),
  );
  const hotkeys = new Map(
    clipPresets.map((preset) => [preset.seconds, preset.hotkey]),
  );
  const { replayOff, sceneMismatch, canClip } = getClipAvailability(
    obsStatus,
    busy,
    clipScene,
  );
  const disabledReason = replayOff
    ? "Wiederholungspuffer ist aus"
    : sceneMismatch
      ? "OBS ist auf einer anderen Szene"
      : busy
        ? "Clip wird gespeichert…"
        : undefined;

  return (
    <header className="flex min-h-12 shrink-0 items-center gap-3 border-b border-white/10 bg-card/55 px-4 py-2 backdrop-blur-xl">
      <SidebarTrigger className="text-muted-foreground" />
      <Separator orientation="vertical" className="h-6" />
      <div className="min-w-0">
        <h1 className="truncate text-sm font-medium tracking-tight">
          {copy.title}
        </h1>
        <p className="truncate text-xs text-muted-foreground">
          {copy.description}
        </p>
      </div>
      <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2">
        {connected ? (
          <ButtonGroup className="flex-wrap">
            {presets.map(({ seconds, label, hint }) => {
              const replayMax = obsStatus.replayMaxSeconds ?? null;
              const overBuffer = replayMax != null && seconds > replayMax;
              const active = lastSeconds === seconds;
              const hotkey = hotkeys.get(seconds);
              const hotkeyLabel = hotkey ? formatHotkey(hotkey) : null;
              return (
                <Button
                  key={seconds}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  className={cn(busy && active && "shimmer")}
                  disabled={!canClip || overBuffer}
                  title={
                    overBuffer && replayMax != null
                      ? `Länger als der OBS-Puffer (${formatDuration(replayMax)})`
                      : [disabledReason ?? hint, hotkeyLabel]
                        .filter(Boolean)
                        .join(" · ")
                  }
                  onClick={() => onCreate(seconds)}
                >
                  <ClockIcon data-icon="inline-start" className="opacity-70" />
                  {label}
                  {hotkeyLabel ? (
                    <span
                      className={
                        active ? "opacity-80" : "text-muted-foreground"
                      }
                    >
                      {hotkeyLabel}
                    </span>
                  ) : null}
                </Button>
              );
            })}
          </ButtonGroup>
        ) : null}
        <ObsStatusPill status={obsStatus} onGoToSettings={onGoToObsSettings} />
      </div>
    </header>
  );
}
