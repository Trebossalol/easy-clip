import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import type { AppConfigDto, ClipPreset, ObsStatus, TagRecord } from "@shared/ipc";
import {
  MAX_TAG_NAME_LENGTH,
  normalizeTagName,
} from "@shared/tags/names";
import { formatDuration } from "@/format";
import {
  ClockIcon,
  PlusIcon,
  TagsIcon,
  TriangleAlertIcon,
  TypeIcon,
  UnplugIcon,
} from "lucide-react";
import { getClipAvailability } from "@/components/ClipActions";
import logoUrl from "@ressources/logo.svg";
import { cn } from "@/lib/utils";

export function isQuickActionRoute(): boolean {
  return window.location.hash.replace(/^#/, "") === "quick";
}

function presetValue(preset: ClipPreset): string {
  return String(preset.seconds);
}

export function QuickActionWindow() {
  const [config, setConfig] = useState<AppConfigDto | null>(null);
  const [obsStatus, setObsStatus] = useState<ObsStatus | null>(null);
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [title, setTitle] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [tagBusy, setTagBusy] = useState(false);
  const [selected, setSelected] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    const [nextConfig, nextStatus, nextTags] = await Promise.all([
      window.api.getConfig(),
      window.api.getObsStatus(),
      window.api.listTags(),
    ]);
    setConfig(nextConfig);
    setObsStatus(nextStatus);
    setTags(nextTags);
  }, []);

  const resetForm = useCallback(() => {
    setTitle("");
    setSelectedTagIds([]);
    setTagDraft("");
    requestAnimationFrame(() => {
      titleRef.current?.focus();
      titleRef.current?.select();
    });
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("quick-action");
    return () => {
      document.documentElement.classList.remove("quick-action");
    };
  }, []);

  useEffect(() => {
    void reload();
    resetForm();
    const unsubs = [
      window.api.onObsStatus(setObsStatus),
      window.api.onTagsChanged(setTags),
      window.api.onQuickActionOpened(() => {
        void reload();
        resetForm();
      }),
    ];
    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [reload, resetForm]);

  const presets = config?.CLIP_PRESETS ?? [];
  const { connected, replayOff, sceneMismatch, canClip } = getClipAvailability(
    obsStatus,
    false,
    config?.OBS_SCENE,
  );
  const replayMax = obsStatus?.replayMaxSeconds ?? null;

  const isPresetEnabled = useCallback(
    (seconds: number): boolean => {
      const overBuffer = replayMax != null && seconds > replayMax;
      return canClip && !overBuffer;
    },
    [canClip, replayMax],
  );

  const enabledPresets = presets.filter((preset) =>
    isPresetEnabled(preset.seconds),
  );

  useEffect(() => {
    const current = enabledPresets.find((preset) => presetValue(preset) === selected);
    if (current) return;
    setSelected(enabledPresets[0] ? presetValue(enabledPresets[0]) : "");
  }, [enabledPresets, selected]);

  const selectPreset = useCallback(
    (seconds: number) => {
      const name = title.trim();
      void window.api.selectQuickAction(
        seconds,
        name || undefined,
        selectedTagIds.length > 0 ? selectedTagIds : undefined,
      );
    },
    [selectedTagIds, title],
  );

  const saveSelected = useCallback((): void => {
    const preset = enabledPresets.find((item) => presetValue(item) === selected);
    if (!preset) return;
    selectPreset(preset.seconds);
  }, [enabledPresets, selectPreset, selected]);

  const moveSelection = useCallback(
    (direction: 1 | -1): void => {
      if (enabledPresets.length === 0) return;
      const index = enabledPresets.findIndex(
        (preset) => presetValue(preset) === selected,
      );
      const from = index < 0 ? 0 : index;
      const next =
        enabledPresets[
        (from + direction + enabledPresets.length) % enabledPresets.length
        ];
      if (next) setSelected(presetValue(next));
    },
    [enabledPresets, selected],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        void window.api.closeQuickAction();
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea")) return;
      const index = Number(event.key) - 1;
      if (!Number.isInteger(index) || index < 0 || index >= presets.length) {
        return;
      }
      const preset = presets[index];
      if (!preset) return;
      if (!isPresetEnabled(preset.seconds)) return;
      event.preventDefault();
      selectPreset(preset.seconds);
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isPresetEnabled, presets, selectPreset]);

  function onTitleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter") {
      event.preventDefault();
      saveSelected();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(-1);
    }
  }

  function toggleTag(tagId: string): void {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  }

  async function createTag(e: FormEvent): Promise<void> {
    e.preventDefault();
    const name = normalizeTagName(tagDraft);
    if (!name || tagBusy) return;

    const existing = tags.find(
      (tag) => tag.name.toLowerCase() === name.toLowerCase(),
    );
    setTagBusy(true);
    try {
      if (existing) {
        if (!selectedTagIds.includes(existing.id)) {
          setSelectedTagIds((prev) => [...prev, existing.id]);
        }
        setTagDraft("");
        return;
      }
      const result = await window.api.createTag(name);
      if (!result.ok) return;
      setTagDraft("");
      setSelectedTagIds((prev) =>
        prev.includes(result.tag.id) ? prev : [...prev, result.tag.id],
      );
    } finally {
      setTagBusy(false);
    }
  }

  return (
    <div className="flex h-full items-start justify-center p-2">
      <Card size="sm" className="glass w-full shadow-lg ring-primary/20">
        <CardHeader className="border-b border-white/10">
          <CardTitle className="flex items-center gap-2">
            <img src={logoUrl} alt="" className="size-6 rounded-md" />
            Clip speichern
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 px-0 pb-2">
          <div className="flex flex-col gap-2 px-(--card-spacing)">
            {replayOff ? (
              <Alert>
                <TriangleAlertIcon />
                <AlertTitle>Wiederholungspuffer ist aus</AlertTitle>
                <AlertDescription>
                  Starte ihn in OBS, dann kannst du clippen.
                </AlertDescription>
              </Alert>
            ) : sceneMismatch ? (
              <Alert>
                <TriangleAlertIcon />
                <AlertTitle>Falsche OBS-Szene</AlertTitle>
                <AlertDescription>
                  Clips nutzen „{config?.OBS_SCENE?.trim()}“. Starte OBS über Easy
                  Clip, damit der Puffer diese Szene aufzeichnet.
                </AlertDescription>
              </Alert>
            ) : !connected ? (
              <Alert variant="error" className="items-center *:[svg]:row-span-1 *:[svg]:translate-y-0">
                <UnplugIcon />
                <AlertTitle>OBS ist nicht verbunden</AlertTitle>
              </Alert>
            ) : null}
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="quick-clip-title" className="sr-only">
                  Titel
                </FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <TypeIcon className="opacity-70" />
                  </InputGroupAddon>
                  <InputGroupInput
                    ref={titleRef}
                    id="quick-clip-title"
                    type="text"
                    autoComplete="off"
                    placeholder="Optional"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={onTitleKeyDown}
                  />
                </InputGroup>
              </Field>
              <Field>
                <FieldLabel className="sr-only">Tags</FieldLabel>
                {tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {tags.map((tag) => {
                      const active = selectedTagIds.includes(tag.id);
                      return (
                        <Badge
                          key={tag.id}
                          variant={active ? "default" : "outline"}
                          className={cn(
                            "cursor-pointer select-none",
                            active && "bg-primary text-primary-foreground",
                          )}
                          onClick={() => toggleTag(tag.id)}
                        >
                          <TagsIcon
                            data-icon="inline-start"
                            className="opacity-70"
                          />
                          {tag.name}
                        </Badge>
                      );
                    })}
                  </div>
                ) : null}
                <form
                  className="flex items-center gap-1"
                  onSubmit={(e) => void createTag(e)}
                >
                  <InputGroup className="flex-1">
                    <InputGroupAddon>
                      <TagsIcon className="opacity-70" />
                    </InputGroupAddon>
                    <InputGroupInput
                      type="text"
                      autoComplete="off"
                      maxLength={MAX_TAG_NAME_LENGTH}
                      placeholder="Neues Tag…"
                      value={tagDraft}
                      disabled={tagBusy}
                      onChange={(e) => setTagDraft(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    <InputGroupButton
                      type="submit"
                      size="icon-xs"
                      variant="secondary"
                      disabled={tagBusy || !normalizeTagName(tagDraft)}
                      aria-label="Tag anlegen und zuweisen"
                    >
                      <PlusIcon />
                    </InputGroupButton>
                  </InputGroup>
                </form>
              </Field>
            </FieldGroup>
          </div>
          <Command
            loop
            shouldFilter={false}
            value={selected}
            onValueChange={setSelected}
          >
            <CommandList>
              <CommandGroup>
                {presets.map((preset, index) => {
                  const disabled = !isPresetEnabled(preset.seconds);
                  return (
                    <CommandItem
                      key={preset.seconds}
                      value={presetValue(preset)}
                      disabled={disabled}
                      className="data-selected:bg-primary/15 data-selected:*:[svg]:text-primary"
                      onSelect={() => {
                        if (disabled) return;
                        selectPreset(preset.seconds);
                      }}
                    >
                      <ClockIcon className="opacity-70" />
                      Letzte {formatDuration(preset.seconds)}
                      <CommandShortcut>{index + 1}</CommandShortcut>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </CardContent>
      </Card>
    </div>
  );
}
