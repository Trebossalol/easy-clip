import { useEffect, useState } from "react";
import type { ClipConfirmPayload } from "@shared/ipc";
import { formatDuration } from "@/format";
import { CheckIcon, TriangleAlertIcon } from "lucide-react";
import logoUrl from "@ressources/logo.svg";
import { cn } from "@/lib/utils";

export function isConfirmRoute(): boolean {
  return window.location.hash.replace(/^#/, "") === "confirm";
}

export function ConfirmWindow() {
  const [payload, setPayload] = useState<ClipConfirmPayload | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("clip-confirm");
    return () => {
      document.documentElement.classList.remove("clip-confirm");
    };
  }, []);

  useEffect(() => {
    return window.api.onClipConfirm((next) => {
      setPayload(next);
    });
  }, []);

  if (!payload) {
    return <div className="h-full w-full bg-transparent" />;
  }

  const ok = payload.ok;
  const label = ok
    ? payload.title?.trim()
      ? `„${payload.title.trim()}“ · ${formatDuration(payload.seconds)}`
      : `Clip gespeichert · ${formatDuration(payload.seconds)}`
    : payload.error?.trim() || "Clip fehlgeschlagen";

  return (
    <div className="flex h-full items-center justify-center p-1.5">
      <div
        className={cn(
          "glass flex w-full items-center gap-2 rounded-xl px-3 py-2 shadow-lg ring-1",
          ok ? "ring-primary/30" : "ring-destructive/40",
        )}
      >
        <img src={logoUrl} alt="" className="size-6 shrink-0 rounded-md" />
        <div
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full",
            ok ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive",
          )}
        >
          {ok ? (
            <CheckIcon className="size-3.5" />
          ) : (
            <TriangleAlertIcon className="size-3.5" />
          )}
        </div>
        <p className="min-w-0 truncate text-sm font-medium text-foreground">
          {label}
        </p>
      </div>
    </div>
  );
}
