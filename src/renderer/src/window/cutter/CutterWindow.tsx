import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { ClipRecord, CutRange, ScaleTarget } from "@shared/ipc";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircleIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { ClipCutter } from "@/components/ClipCutter";
import { CutterClipPicker } from "@/components/CutterClipPicker";
import { useTopLoader } from "@/components/TopLoadingBar";
import logoUrl from "@ressources/logo.svg"

export function isCutterRoute(): boolean {
  const hash = window.location.hash.replace(/^#/, "");
  return hash === "cut" || hash.startsWith("cut/");
}

export function parseCutClipId(): string | null {
  const hash = window.location.hash.replace(/^#/, "");
  const match = /^cut\/([^/]+)$/.exec(hash);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function CutterTab({
  clipId,
  clip,
  active,
  busy,
  error,
  onClose,
  onSave,
  onExportGif,
}: {
  clipId: string;
  clip: ClipRecord | undefined;
  active: boolean;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (
    ranges: CutRange[],
    overwrite?: boolean,
    scale?: ScaleTarget | null,
    name?: string | null,
  ) => void;
  onExportGif: (ranges: CutRange[]) => void;
}) {
  const loader = useTopLoader();
  const [fetched, setFetched] = useState<ClipRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (clip && !clip.missing) {
      setFetched(clip);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    loader.begin();
    void window.api
      .getClip(clipId)
      .then((next) => {
        if (cancelled) return;
        if (!next || next.missing) {
          setLoadError("Clip nicht gefunden oder Datei fehlt.");
          setFetched(null);
          return;
        }
        setLoadError(null);
        setFetched(next);
      })
      .finally(() => {
        if (!cancelled) loader.end();
      });
    return () => {
      cancelled = true;
      loader.end();
    };
  }, [clip, clipId]);

  const resolved = clip && !clip.missing ? clip : fetched;

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircleIcon />
          <AlertTitle>Clip nicht verfügbar</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <Button type="button" variant="outline" onClick={onClose}>
          Tab schließen
        </Button>
      </div>
    );
  }

  if (!resolved) {
    return (
      <div className="flex h-full flex-col gap-3 p-5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <ClipCutter
      clip={resolved}
      busy={busy}
      active={active}
      error={error}
      onCancel={onClose}
      onSave={onSave}
      onExportGif={onExportGif}
    />
  );
}

export function CutterWindow() {
  const loader = useTopLoader();
  const initialId = parseCutClipId();
  const [clips, setClips] = useState<ClipRecord[]>([]);
  const [clipsReady, setClipsReady] = useState(false);
  const [tabIds, setTabIds] = useState<string[]>(() =>
    initialId ? [initialId] : [],
  );
  const [activeId, setActiveId] = useState<string | null>(initialId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cutErrors, setCutErrors] = useState<Record<string, string>>({});

  const availableClips = clips.filter((clip) => !clip.missing);

  function openTab(id: string): void {
    setTabIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setActiveId(id);
    setPickerOpen(false);
  }

  function closeTab(id: string): void {
    setTabIds((prev) => {
      const next = prev.filter((item) => item !== id);
      setActiveId((current) => {
        if (current !== id) return current;
        const index = prev.indexOf(id);
        return next[Math.min(index, next.length - 1)] ?? next[0] ?? null;
      });
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;
    const unsubs: Array<() => void> = [];

    loader.begin();
    void window.api
      .listClips()
      .then((list) => {
        if (cancelled) return;
        setClips(list);
        setClipsReady(true);
      })
      .finally(() => {
        if (!cancelled) loader.end();
      });
    unsubs.push(
      window.api.onClipsChanged((list) => {
        setClips(list);
        setClipsReady(true);
      }),
    );
    unsubs.push(
      window.api.onCutterOpenClip((id) => {
        setTabIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
        setActiveId(id);
        setPickerOpen(false);
      }),
    );

    return () => {
      cancelled = true;
      loader.end();
      for (const unsub of unsubs) unsub();
    };
  }, []);

  useEffect(() => {
    if (!clipsReady || initialId != null) return;
    if (tabIds.length > 0) return;
    if (!clips.some((clip) => !clip.missing)) return;
    setPickerOpen(true);
  }, [clipsReady]);

  useEffect(() => {
    if (!clipsReady) return;
    const valid = new Set(
      clips.filter((clip) => !clip.missing).map((clip) => clip.id),
    );
    setTabIds((prev) => {
      const next = prev.filter((id) => valid.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [clips, clipsReady]);

  useEffect(() => {
    if (activeId && tabIds.includes(activeId)) return;
    setActiveId(tabIds[tabIds.length - 1] ?? null);
  }, [tabIds, activeId]);

  useEffect(() => {
    const clip = clips.find((item) => item.id === activeId);
    document.title = clip ? `Schneiden — ${clip.name}` : "Schneiden";
  }, [activeId, clips]);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (e.key === "o" || e.key === "O" || e.key === "t" || e.key === "T") {
        e.preventDefault();
        setPickerOpen(true);
        return;
      }
      if ((e.key === "w" || e.key === "W") && activeId) {
        e.preventDefault();
        closeTab(activeId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId]);

  async function saveCut(
    clipId: string,
    ranges: CutRange[],
    overwrite = false,
    scale?: ScaleTarget | null,
    name?: string | null,
  ): Promise<void> {
    setBusyId(clipId);
    setCutErrors((prev) => {
      if (!(clipId in prev)) return prev;
      const next = { ...prev };
      delete next[clipId];
      return next;
    });
    try {
      const result = await loader.wrap(() =>
        window.api.cutClip(clipId, ranges, overwrite, scale, name),
      );
      if (!result.ok) {
        setCutErrors((prev) => ({ ...prev, [clipId]: result.error }));
        toast.error(result.error);
        return;
      }
      toast.success(
        overwrite ? "Clip überschrieben." : "Neuer Clip gespeichert.",
      );
      closeTab(clipId);
    } finally {
      setBusyId(null);
    }
  }

  async function exportGif(clipId: string, ranges: CutRange[]): Promise<void> {
    setBusyId(clipId);
    setCutErrors((prev) => {
      if (!(clipId in prev)) return prev;
      const next = { ...prev };
      delete next[clipId];
      return next;
    });
    try {
      const result = await loader.wrap(() =>
        window.api.exportGif(clipId, ranges),
      );
      if (!result.ok) {
        setCutErrors((prev) => ({ ...prev, [clipId]: result.error }));
        toast.error(result.error);
        return;
      }
      toast.success("GIF exportiert.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="app-mesh flex h-full min-h-0 flex-col overflow-hidden">
      {tabIds.length === 0 ? (
        <Empty className="min-h-0 flex-1 border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <img
                src={logoUrl}
                alt=""
                className="size-8 rounded-lg"
              />
            </EmptyMedia>

            <EmptyTitle>Clip schneiden</EmptyTitle>
            <EmptyDescription>
              {availableClips.length === 0
                ? "Lege zuerst Clips in der Bibliothek an."
                : "Wähle einen Clip aus um ihn zu bearbeiten."}
            </EmptyDescription>
          </EmptyHeader>
          {availableClips.length > 0 ? (
            <EmptyContent>
              <Button type="button" onClick={() => setPickerOpen(true)}>
                Clip auswählen
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : (
        <Tabs
          value={activeId ?? tabIds[0]}
          onValueChange={setActiveId}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="flex shrink-0 items-center gap-1 border-b border-white/10 bg-card/55 px-1 backdrop-blur-xl">
            <TabsList
              variant="line"
              className="no-scrollbar h-10 min-w-0 flex-1 justify-start overflow-x-auto overflow-y-hidden rounded-none bg-transparent p-0"
            >
              {tabIds.map((id) => {
                const clip = clips.find((item) => item.id === id);
                return (
                  <div key={id} className="relative flex shrink-0">
                    <TabsTrigger
                      value={id}
                      className="max-w-44 flex-none pr-7 data-active:text-primary after:bg-primary"
                    >
                      <span className="truncate">{clip?.name ?? "Clip"}</span>
                    </TabsTrigger>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      className="absolute top-1/2 right-0.5 -translate-y-1/2"
                      aria-label="Tab schließen"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(id);
                      }}
                    >
                      <XIcon />
                    </Button>
                  </div>
                );
              })}
            </TabsList>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              title="Clip öffnen (Strg+O)"
              onClick={() => setPickerOpen(true)}
            >
              <PlusIcon />
              <span className="sr-only">Clip öffnen</span>
            </Button>
          </div>
          {tabIds.map((id) => (
            <TabsContent
              key={id}
              value={id}
              forceMount
              className="min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
            >
              <CutterTab
                clipId={id}
                clip={clips.find((item) => item.id === id)}
                active={id === activeId}
                busy={busyId === id}
                error={cutErrors[id] ?? null}
                onClose={() => closeTab(id)}
                onSave={(ranges, overwrite, scale, name) =>
                  void saveCut(id, ranges, overwrite, scale, name)
                }
                onExportGif={(ranges) => void exportGif(id, ranges)}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}

      <CutterClipPicker
        open={pickerOpen}
        clips={availableClips}
        openTabIds={tabIds}
        onOpenChange={setPickerOpen}
        onSelect={openTab}
      />
      <Toaster theme="dark" closeButton />
    </div>
  );
}
