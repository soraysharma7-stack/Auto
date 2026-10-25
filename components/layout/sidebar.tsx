"use client";

import { ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/ui/logo";
import { navigationGroups, settingsItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  open,
  configured,
  userEmail,
  onClose,
}: {
  open: boolean;
  configured: boolean;
  userEmail: string | null;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Primary navigation"
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-[var(--sidebar-line)] bg-[var(--sidebar)] px-4 pb-4 pt-5 transition-transform duration-200 lg:translate-x-0",
        open
          ? "visible translate-x-0"
          : "invisible -translate-x-full lg:visible lg:translate-x-0",
      )}
    >
      <div className="mb-7 flex items-center justify-between px-2">
        <Link
          href="/dashboard"
          aria-label="Auto dashboard"
          onClick={onClose}
          className="rounded-lg"
        >
          <Logo />
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
          className="grid size-9 place-items-center rounded-xl text-[var(--sidebar-muted)] transition-colors hover:bg-white/5 hover:text-white lg:hidden"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto">
        {navigationGroups.map((group) => (
          <div key={group.label} className="mb-6">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.17em] text-[var(--sidebar-muted)]">
              {group.label}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors",
                        active
                          ? "bg-white/[0.09] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
                          : "text-[var(--sidebar-muted)] hover:bg-white/[0.045] hover:text-[var(--sidebar-ink)]",
                      )}
                    >
                      <Icon
                        aria-hidden="true"
                        className={cn(
                          "size-[17px] shrink-0",
                          active
                            ? "text-[#b8adff]"
                            : "text-[var(--sidebar-muted)] group-hover:text-[var(--sidebar-ink)]",
                        )}
                        strokeWidth={active ? 2 : 1.7}
                      />
                      <span>{item.label}</span>
                      {active ? (
                        <span className="ml-auto size-1.5 rounded-full bg-[#a7f3d0]" />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-2 border-t border-[var(--sidebar-line)] pt-3">
        <Link
          href={settingsItem.href}
          onClick={onClose}
          aria-current={isActive(pathname, settingsItem.href) ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors",
            isActive(pathname, settingsItem.href)
              ? "bg-white/[0.09] text-white"
              : "text-[var(--sidebar-muted)] hover:bg-white/[0.045] hover:text-white",
          )}
        >
          <settingsItem.icon aria-hidden="true" className="size-[17px]" />
          Settings
        </Link>

        <div className="mt-3 rounded-2xl border border-[var(--sidebar-line)] bg-white/[0.025] p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--sidebar-muted)]">
              Workspace
            </span>
            <span className="text-[11px] font-semibold text-[#b8adff]">{configured ? "ACTIVE" : "SETUP"}</span>
          </div>
          <p className="mt-2 truncate text-sm font-medium text-[var(--sidebar-ink)]" title={userEmail ?? "Supabase setup required"}>
            {userEmail ?? "Supabase setup required"}
          </p>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] leading-4 text-[var(--sidebar-muted)]">
            <ShieldCheck aria-hidden="true" className="size-3.5 shrink-0" />
            Real features. Explicit control.
          </p>
        </div>
      </div>
    </aside>
  );
}
