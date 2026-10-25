"use client";

import { ChevronRight, Menu } from "lucide-react";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getPageTitle } from "@/lib/navigation";

export function Header({
  configured,
  onMenuOpen,
}: {
  configured: boolean;
  onMenuOpen: () => void;
}) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-[68px] items-center border-b border-line bg-canvas/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <button
        type="button"
        aria-label="Open navigation"
        onClick={onMenuOpen}
        className="mr-3 grid size-9 place-items-center rounded-xl border border-line bg-surface text-muted lg:hidden"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>

      <div className="flex min-w-0 items-center gap-2 text-sm">
        <span className="hidden text-subtle sm:inline">Auto</span>
        <ChevronRight
          aria-hidden="true"
          className="hidden size-3.5 text-subtle sm:inline"
        />
        <span className="truncate font-medium text-ink">{title}</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <Badge variant={configured ? "success" : "brand"} className="hidden sm:inline-flex">
          <span className="size-1.5 rounded-full bg-current" />
          {configured ? "Signed in" : "Setup mode"}
        </Badge>
        <ThemeToggle />
      </div>
    </header>
  );
}
