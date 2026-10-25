import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-[30px] font-semibold tracking-[-0.045em] text-ink sm:text-[36px]">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-6 text-muted">
          {description}
        </p>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
