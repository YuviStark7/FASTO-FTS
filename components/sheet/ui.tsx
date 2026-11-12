import { CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";

export function Panel({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("card p-4 sm:p-6", className)}>
      {title && <h3 className="t-label mb-4">{title}</h3>}
      {children}
    </section>
  );
}

export function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="t-label mb-0.5">{label}</div>
      {children}
    </div>
  );
}

/**
 * Designed insufficient state: hatched, never a zero (product rule 2).
 * The hatched band carries the meaning; the words sit on a plain plate beside it so they keep AA contrast.
 */
export function InsufficientState({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="status" className="hatched flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-border-strong/60 shadow-e1 sm:flex-row">
      <div aria-hidden className="grid h-14 shrink-0 place-items-center sm:h-auto sm:w-24">
        <CircleDashed strokeWidth={1.5} className="size-7 text-text" />
      </div>
      <div className="m-1.5 flex-1 space-y-2 rounded-[14px] bg-surface p-4 sm:p-5">
        <p className="text-lg leading-snug font-medium tracking-[-0.01em]">{title}</p>
        <div className="space-y-2 text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
