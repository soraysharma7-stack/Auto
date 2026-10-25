import { cn } from "@/lib/utils";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3">
      <span className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-[#705df0] text-white shadow-[0_6px_20px_rgba(105,87,232,0.28)]">
        <svg
          aria-hidden="true"
          viewBox="0 0 32 32"
          className="size-6"
          fill="none"
        >
          <path
            d="m7.5 23 7-16h3l7 16h-4.3l-1.35-3.5h-6.7L10.8 23H7.5Zm7.1-7h2.8L16 12l-1.4 4Z"
            fill="currentColor"
          />
        </svg>
        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-[#1c1c27] bg-[#a7f3d0]" />
      </span>
      <span
        className={cn(
          "font-display text-[22px] font-semibold tracking-[-0.04em] text-[var(--sidebar-ink)]",
          compact && "sr-only",
        )}
      >
        Auto
      </span>
    </span>
  );
}
