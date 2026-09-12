import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import {
  FolderIcon,
  FolderOutputIcon,
  FolderSyncIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { StoragePanel } from "./StoragePanel";
import { useSettingsForm } from "@/context/settings-form-context";
import { APP_NAME } from "@shared/app.config";

export function StorageSection() {
  const {
    outputDir,
    onOutputDirChange,
    onBrowseOutputDir,
    obsRecordDirectory,
    outputDirMismatch,
    onAdoptObsOutputDir,
  } = useSettingsForm();
  const [adopting, setAdopting] = useState(false);

  async function adopt(): Promise<void> {
    if (adopting) return;
    setAdopting(true);
    try {
      await onAdoptObsOutputDir();
    } finally {
      setAdopting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <FolderOutputIcon className="size-4 text-primary opacity-80" />
            Ausgabe
          </CardTitle>
          <CardDescription>
            Gleicher Ordner wie der Aufnahmepfad von OBS Studio.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {outputDirMismatch ? (
            <Alert variant="warning">
              <TriangleAlertIcon />
              <AlertTitle>Unterschiedliche Clip-Ordner</AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                <span>
                  OBS speichert unter „{obsRecordDirectory}“, {APP_NAME} nutzt
                  „{outputDir}“.
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="w-fit"
                  disabled={adopting}
                  onClick={() => void adopt()}
                >
                  {adopting ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <FolderSyncIcon data-icon="inline-start" />
                  )}
                  Clip-Ordner an OBS anpassen
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="clip-output-dir">
                Clip-Ausgabeordner
              </FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="clip-output-dir"
                  type="text"
                  required
                  autoComplete="off"
                  value={outputDir}
                  onChange={(e) => onOutputDirChange(e.target.value)}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="button"
                    size="xs"
                    onClick={onBrowseOutputDir}
                  >
                    <FolderIcon data-icon="inline-start" />
                    Durchsuchen
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>
                Easy Clip überwacht diesen Ordner, um neue Clips zu erkennen.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
      <StoragePanel />
    </div>
  );
}
