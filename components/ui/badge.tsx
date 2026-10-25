import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type BadgeVariant = "neutral" | "brand" | "success" | "warning";

const variants: Record<BadgeVariant, string> = {
  neutral: "bg-surface-soft text-muted ring-line",
  brand: "bg-brand-soft text-brand-strong ring-brand/15",
  success: "bg-success-soft text-success ring-success/15",
  warning: "bg-warning-soft text-warning ring-warning/15",
};

export function Badge({
  children,
  variant = "neutral",
  className,
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em] ring-1 ring-inset",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
