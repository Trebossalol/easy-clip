import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import {
  CableIcon,
  EyeIcon,
  EyeOffIcon,
  FilmIcon,
  FolderIcon,
  InfoIcon,
  TriangleAlertIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/format";
import {
  MAX_OBS_REPLAY_SECONDS,
  MIN_OBS_REPLAY_SECONDS,
} from "@shared/app.config";
import { useSettingsForm } from "@/context/settings-form-context";

export function ObsSection() {
  const {
    obsUrl,
    obsPassword,
    obsExePath,
    obsScene,
    obsReplayMinutes,
    obsReplaySeconds,
    replayInvalid,
    showPassword,
    onObsUrlChange,
    onObsPasswordChange,
    onObsExePathChange,
    onBrowseObsExe,
    onObsSceneChange,
    onObsReplayMinutesChange,
    onObsReplaySecondsChange,
    onTogglePassword,
    outputDirMismatch,
    obsRecordDirectory,
    onAdoptObsOutputDir,
  } = useSettingsForm();

  const [scenes, setScenes] = useState<string[]>([]);
  const [obsConnected, setObsConnected] = useState(false);
  const setupPending = obsPassword === "CHANGE_ME";

  useEffect(() => {
    let cancelled = false;

    async function loadScenes(): Promise<void> {
      const [status, listed] = await Promise.all([
        window.api.getObsStatus(),
        window.api.getObsScenes(),
      ]);
      if (cancelled) return;
      setObsConnected(status.connected);
      if (listed.ok) setScenes(listed.scenes);
    }

    void loadScenes();
    const unsub = window.api.onObsStatus((status) => {
      setObsConnected(status.connected);
      if (status.connected) void loadScenes();
      else setScenes([]);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const sceneOptions = useMemo(() => {
    const names = [...scenes];
    const selected = obsScene.trim();
    if (selected && !names.includes(selected)) names.unshift(selected);
    return names;
  }, [obsScene, scenes]);

  return (
    <div className="flex flex-col gap-4">
      {outputDirMismatch ? (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>Unterschiedliche Clip-Ordner</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>
              OBS speichert unter „{obsRecordDirectory}“. Passe den Easy-Clip-
              Ausgabeordner unter Speicher an, oder übernimm den OBS-Pfad.
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-fit"
              onClick={() => void onAdoptObsOutputDir()}
            >
              <FolderIcon data-icon="inline-start" />
              Clip-Ordner an OBS anpassen
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <Accordion
        type="single"
        collapsible
        defaultValue={setupPending ? "server" : undefined}
      >
        <Card>
          <AccordionItem value="server" className="border-0">
            <CardHeader>
              <AccordionTrigger className="py-0 hover:no-underline">
                <CardTitle className="flex items-center gap-1.5">
                  <CableIcon className="size-4 text-primary opacity-80" />
                  Server
                </CardTitle>
              </AccordionTrigger>
              <CardDescription>
                Verbindungseinstellungen zu OBS Studio.
              </CardDescription>
            </CardHeader>
            <AccordionContent>
              <CardContent className="flex flex-col gap-4 pt-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="obs-url">Server</FieldLabel>
                    <Input
                      id="obs-url"
                      type="text"
                      inputMode="url"
                      autoComplete="off"
                      value={obsUrl}
                      onChange={(e) => onObsUrlChange(e.target.value)}
                    />
                    <FieldDescription>
                      Ändere diese Einstellung nur, wenn du weißt was du tust.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="obs-password">Passwort</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id="obs-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="off"
                        value={obsPassword}
                        onChange={(e) => onObsPasswordChange(e.target.value)}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton
                          type="button"
                          size="icon-xs"
                          onClick={onTogglePassword}
                          aria-label={
                            showPassword
                              ? "Passwort verbergen"
                              : "Passwort anzeigen"
                          }
                        >
                          {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>
                    <FieldDescription>
                      Trage hier das gleiche Passwort wie in den OBS WebSocket
                      Server Einstellungen ein.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="obs-exe-path">
                      OBS-Programmdatei
                    </FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id="obs-exe-path"
                        type="text"
                        autoComplete="off"
                        placeholder="C:\Program Files\obs-studio\bin\64bit\obs64.exe"
                        value={obsExePath}
                        onChange={(e) => onObsExePathChange(e.target.value)}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton
                          type="button"
                          size="xs"
                          onClick={onBrowseObsExe}
                        >
                          <FolderIcon data-icon="inline-start" />
                          Durchsuchen
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>
                    <FieldDescription>
                      Leer lassen, wenn OBS unter C:\Program Files liegt.
                      Sonst die Datei obs64.exe wählen — etwa auf einem anderen
                      Laufwerk.
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </CardContent>
            </AccordionContent>
          </AccordionItem>
        </Card>
      </Accordion>

      <Accordion type="single" collapsible defaultValue="recording">
        <Card>
          <AccordionItem value="recording" className="border-0">
            <CardHeader>
              <AccordionTrigger className="py-0 hover:no-underline">
                <CardTitle className="flex items-center gap-1.5">
                  <FilmIcon className="size-4 text-primary opacity-80" />
                  Aufnahme
                </CardTitle>
              </AccordionTrigger>
            </CardHeader>
            <AccordionContent>
              <CardContent className="flex flex-col gap-4 pt-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="obs-scene">Aufnahmeszene</FieldLabel>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={
                            obsScene
                              ? "justify-start"
                              : "justify-start text-muted-foreground"
                          }
                          disabled={!obsConnected}
                        >
                          {obsScene || "Keine Szene ausgewählt"}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => onObsSceneChange("")}>
                          Keine Szene
                        </DropdownMenuItem>
                        {sceneOptions.map((name) => (
                          <DropdownMenuItem
                            key={name}
                            onClick={() => onObsSceneChange(name)}
                          >
                            {name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <FieldDescription>
                      Diese Szene wird für die Clipaufnahme verwendet.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="obs-replay-min">
                      Wiederholungspuffer
                    </FieldLabel>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <InputGroup className="w-28">
                        <InputGroupInput
                          id="obs-replay-min"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={Math.floor(MAX_OBS_REPLAY_SECONDS / 60)}
                          step={1}
                          aria-label="Minuten"
                          aria-invalid={replayInvalid}
                          value={obsReplayMinutes}
                          onChange={(e) => onObsReplayMinutesChange(e.target.value)}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>Min</InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                      <InputGroup className="w-28">
                        <InputGroupInput
                          id="obs-replay-sec"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={59}
                          step={1}
                          aria-label="Sekunden"
                          aria-invalid={replayInvalid}
                          value={obsReplaySeconds}
                          onChange={(e) => onObsReplaySecondsChange(e.target.value)}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>Sek</InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                    </div>
                    {replayInvalid ? (
                      <FieldError>
                        Die Pufferdauer muss zwischen{" "}
                        {formatDuration(MIN_OBS_REPLAY_SECONDS)} und{" "}
                        {formatDuration(MAX_OBS_REPLAY_SECONDS)} liegen.
                      </FieldError>
                    ) : (
                      <FieldDescription>
                        Dieser Wert sollte so groß sein, wie die maximale Clip-Länge.
                      </FieldDescription>
                    )}
                  </Field>
                  <Alert variant={'warning'}>
                    <TriangleAlertIcon />
                    <AlertDescription>
                      Bitte beachte, dass ein höherer Wert mehr Arbeitsspeicher benötigt. Um die geschätzte Arbeitsspeichermenge einzusehen,
                      öffne OBS und klicke auf Datei → Einstellungen → Ausgabe → Replaypuffer.
                    </AlertDescription>
                  </Alert>
                </FieldGroup>
              </CardContent>
            </AccordionContent>
          </AccordionItem>
        </Card>
      </Accordion>
    </div>
  );
}
