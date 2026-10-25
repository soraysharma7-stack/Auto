import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className,
      )}
    >
      <div className="mb-5 grid size-12 place-items-center rounded-2xl border border-line bg-surface-soft text-muted">
        <Icon aria-hidden="true" className="size-5" strokeWidth={1.7} />
      </div>
      <h2 className="text-base font-semibold tracking-[-0.02em] text-ink">
        {title}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">{description}</p>
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  );
}
