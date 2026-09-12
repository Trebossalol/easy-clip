import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatDuration } from "@/format";
import { APP_NAME } from "@shared/app.config";
import type { ObsStatus } from "@shared/ipc";
import {
  AlertCircleIcon,
  FolderSyncIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function clipPresetsFromSeconds(values: number[]): Array<{
  seconds: number;
  label: string;
  hint: string;
}> {
  return values.map((seconds) => ({
    seconds,
    label: formatDuration(seconds),
    hint: `Letzte ${formatDuration(seconds)}`,
  }));
}

export function getClipAvailability(
  obsStatus: ObsStatus | null,
  busy: boolean,
  clipScene?: string | null,
): {
  connected: boolean;
  replayOff: boolean;
  sceneMismatch: boolean;
  canClip: boolean;
} {
  const connected = obsStatus?.connected === true;
  const replayOff = connected && obsStatus.replayBufferActive === false;
  const scene = clipScene?.trim() || null;
  const sceneMismatch =
    connected &&
    scene != null &&
    obsStatus.currentScene != null &&
    obsStatus.currentScene !== scene;
  const canClip =
    connected &&
    obsStatus.replayBufferActive !== false &&
    !busy &&
    !sceneMismatch;
  return { connected, replayOff, sceneMismatch, canClip };
}

export async function startObsWithAutostart(): Promise<void> {
  const result = await window.api.startObs();
  if (!result.ok) {
    toast.error(result.error ?? "OBS konnte nicht gestartet werden.");
    return;
  }
  toast.success("OBS wird gestartet…");
}

export async function stopObsProcess(): Promise<void> {
  const result = await window.api.stopObs();
  if (!result.ok) {
    toast.error(result.error ?? "OBS konnte nicht beendet werden.");
    return;
  }
  toast.success("OBS wird beendet…");
}

const compactAlert =
  "items-center py-1.5 *:[svg]:row-span-1 *:[svg]:translate-y-0 *:[svg]:opacity-70";

interface ClipActionsProps {
  busy: boolean;
  obsStatus: ObsStatus | null;
  clipScene?: string | null;
  message: { text: string; kind: "ok" | "err" } | null;
  onAdoptObsOutputDir?: () => Promise<void>;
}

export function ClipActions({
  busy,
  obsStatus,
  clipScene,
  message,
  onAdoptObsOutputDir,
}: ClipActionsProps) {
  const { replayOff, sceneMismatch } = getClipAvailability(
    obsStatus,
    busy,
    clipScene,
  );
  const [adopting, setAdopting] = useState(false);
  const folderMismatch = obsStatus?.outputDirMismatch === true;

  async function adoptFolder(): Promise<void> {
    if (!onAdoptObsOutputDir || adopting) return;
    setAdopting(true);
    try {
      await onAdoptObsOutputDir();
    } finally {
      setAdopting(false);
    }
  }

  if (busy) {
    return (
      <Alert className={compactAlert}>
        <Spinner />
        <AlertTitle>Clip wird gespeichert…</AlertTitle>
      </Alert>
    );
  }

  if (replayOff) {
    return (
      <Alert variant="warning" className={compactAlert}>
        <TriangleAlertIcon />
        <AlertTitle>Wiederholungspuffer ist aus</AlertTitle>
        <AlertDescription>
          Starte ihn in OBS oder nutze autostart.bat.
        </AlertDescription>
      </Alert>
    );
  }

  if (sceneMismatch) {
    const wanted = clipScene?.trim() ?? "";
    const current = obsStatus?.currentScene ?? "";
    return (
      <Alert variant="warning" className={compactAlert}>
        <TriangleAlertIcon />
        <AlertTitle>Falsche OBS-Szene</AlertTitle>
        <AlertDescription>
          Clips nutzen „{wanted}“, OBS ist auf „{current}“. Starte OBS über{" "}
          {APP_NAME}, damit der Puffer die richtige Szene aufzeichnet.
        </AlertDescription>
      </Alert>
    );
  }

  if (folderMismatch) {
    return (
      <Alert variant="warning" className="items-start py-2">
        <TriangleAlertIcon />
        <AlertTitle>Unterschiedliche Clip-Ordner</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <span>
            OBS speichert unter „{obsStatus?.recordDirectory}“, {APP_NAME} nutzt
            einen anderen Ausgabeordner. Clips landen sonst am falschen Ort.
          </span>
          {onAdoptObsOutputDir ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-fit"
              disabled={adopting}
              onClick={() => void adoptFolder()}
            >
              {adopting ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <FolderSyncIcon data-icon="inline-start" />
              )}
              Clip-Ordner an OBS anpassen
            </Button>
          ) : null}
        </AlertDescription>
      </Alert>
    );
  }

  if (message?.kind === "err") {
    return (
      <Alert variant="destructive" className={compactAlert}>
        <AlertCircleIcon />
        <AlertTitle>Fehler</AlertTitle>
        <AlertDescription>{message.text}</AlertDescription>
      </Alert>
    );
  }

  return null;
}
