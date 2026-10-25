"use client";

import { Laptop, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

const options: Array<{
  value: "light" | "dark" | "system";
  label: string;
  icon: LucideIcon;
}> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
];

export function ThemeSettings() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <div>
      <div
        role="group"
        aria-label="Color theme"
        className="grid max-w-lg grid-cols-3 gap-2 rounded-2xl border border-line bg-surface-soft/60 p-1.5"
      >
        {options.map((option) => {
          const Icon = option.icon;
          const selected = mounted && theme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => setTheme(option.value)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors",
                selected
                  ? "bg-surface text-brand-strong shadow-sm ring-1 ring-line"
                  : "text-muted hover:bg-surface/70 hover:text-ink",
              )}
            >
              <Icon aria-hidden="true" className="size-4" />
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-subtle">
        This real preference is saved in this browser. System follows your device setting.
      </p>
    </div>
  );
}
