import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Trash2Icon } from "lucide-react";
import type { ClipRecord } from "@shared/ipc";

interface DeleteClipDialogProps {
  clip: ClipRecord;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteClipDialog({
  clip,
  busy,
  onCancel,
  onConfirm,
}: DeleteClipDialogProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-clip-title"
        aria-describedby="delete-clip-desc"
        className="w-full max-w-sm rounded-xl bg-card p-4 text-card-foreground shadow-lg ring-1 ring-foreground/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <Trash2Icon className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 id="delete-clip-title" className="text-sm font-medium">
              Clip löschen?
            </h2>
            <p
              id="delete-clip-desc"
              className="mt-1 text-sm text-muted-foreground"
            >
              {clip.missing
                ? `„${clip.name}“ wird aus der Bibliothek entfernt. Die Datei ist bereits nicht mehr vorhanden.`
                : `„${clip.name}“ wird aus der Bibliothek entfernt und die Datei in den Papierkorb verschoben.`}
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-1.5">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onCancel}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={onConfirm}
          >
            <Trash2Icon data-icon="inline-start" />
            Löschen
          </Button>
        </div>
      </div>
    </div>
  );
}
