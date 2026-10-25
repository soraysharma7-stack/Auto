import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(20,20,30,0.025)]",
        className,
      )}
    >
      {children}
    </section>
  );
}
