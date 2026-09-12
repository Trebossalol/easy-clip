import { APP_NAME } from "@shared/app.config";
import {
  CableIcon,
  ClockIcon,
  HardDriveIcon,
  InfoIcon,
  LibraryIcon,
  PowerIcon,
  ScissorsIcon,
  TagsIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import logoUrl from "@ressources/logo.svg";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

export const SETTINGS_SECTIONS = [
  {
    id: "obs",
    title: "OBS",
    description: "WebSocket, Szene und Wiederholungspuffer",
    icon: CableIcon,
  },
  {
    id: "storage",
    title: "Speicher",
    description: "Ausgabeordner und Speicherplatz",
    icon: HardDriveIcon,
  },
  {
    id: "tags",
    title: "Tags",
    description: "Clips in der Bibliothek kennzeichnen",
    icon: TagsIcon,
  },
  {
    id: "presets",
    title: "Presets",
    description: "Clip-Längen, Hotkeys und Schnellmenü",
    icon: ClockIcon,
  },
  {
    id: "autostart",
    title: "Autostart",
    description: "Mit Windows und OBS starten",
    icon: PowerIcon,
  },
  {
    id: "about",
    title: "Über",
    description: "Version und Projekt",
    icon: InfoIcon,
  },
] as const satisfies ReadonlyArray<{
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
}>;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["id"];
export type AppView = "library" | SettingsSection;

export const LIBRARY_COPY = {
  title: "Bibliothek",
  description: "Clips speichern, umbenennen und schneiden",
} as const;

export function viewCopy(view: AppView): {
  title: string;
  description: string;
} {
  if (view === "library") return LIBRARY_COPY;
  const section = SETTINGS_SECTIONS.find((item) => item.id === view);
  return section ?? LIBRARY_COPY;
}

interface AppSidebarProps {
  view: AppView;
  onViewChange: (view: AppView) => void;
  untitledCount: number;
  onOpenCutter: () => void;
}

export function AppSidebar({
  view,
  onViewChange,
  untitledCount,
  onOpenCutter,
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip={APP_NAME}>
              <img
                src={logoUrl}
                alt=""
                className="size-8 rounded-lg"
              />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-bold">{APP_NAME}</span>
                <span className="truncate text-xs text-muted-foreground">
                  OBS Clipping Software
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={view === "library"}
                  tooltip="Bibliothek"
                  onClick={() => onViewChange("library")}
                >
                  <LibraryIcon />
                  <span>Bibliothek</span>
                </SidebarMenuButton>
                {untitledCount > 0 ? (
                  <SidebarMenuBadge className="bg-primary/15 text-primary">
                    {untitledCount}
                  </SidebarMenuBadge>
                ) : null}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Schneiden — öffnet ein eigenes Fenster"
                  onClick={onOpenCutter}
                >
                  <ScissorsIcon />
                  <span>Schneiden</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Einstellungen</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {SETTINGS_SECTIONS.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={view === item.id}
                      tooltip={item.title}
                      onClick={() => onViewChange(item.id)}
                    >
                      <Icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
