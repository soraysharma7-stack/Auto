"use client";

import { useState, type ReactNode } from "react";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export function AppShell({
  children,
  configured,
  userEmail,
}: {
  children: ReactNode;
  configured: boolean;
  userEmail: string | null;
}) {
  const [navigationOpen, setNavigationOpen] = useState(false);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-lg bg-brand-strong px-4 py-2 text-sm font-medium text-white transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>

      <Sidebar
        open={navigationOpen}
        configured={configured}
        userEmail={userEmail}
        onClose={() => setNavigationOpen(false)}
      />

      {navigationOpen ? (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={() => setNavigationOpen(false)}
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] lg:hidden"
        />
      ) : null}

      <div className="min-h-screen lg:pl-[272px]">
        <Header configured={configured} onMenuOpen={() => setNavigationOpen(true)} />
        <main id="main-content" className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
