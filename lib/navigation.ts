import {
  Activity,
  Bot,
  ChartNoAxesCombined,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  MonitorCog,
  PlugZap,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

export const navigationGroups: NavigationGroup[] = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "AI Chat", href: "/chat", icon: MessageSquareText },
      { label: "AI Team", href: "/agents", icon: Bot },
      { label: "Tasks", href: "/tasks", icon: ListChecks },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      { label: "Connections", href: "/connections", icon: PlugZap },
      { label: "Agent PC", href: "/agent-pc", icon: MonitorCog },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Usage", href: "/usage", icon: ChartNoAxesCombined },
      { label: "Activity", href: "/activity", icon: Activity },
    ],
  },
];

export const settingsItem: NavigationItem = {
  label: "Settings",
  href: "/settings",
  icon: Settings,
};

export const navigationItems: NavigationItem[] = [
  ...navigationGroups.flatMap((group) => group.items),
  settingsItem,
];

export function getPageTitle(pathname: string): string {
  return (
    navigationItems.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )?.label ?? "Auto"
  );
}
