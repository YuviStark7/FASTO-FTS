import { cn } from "@/lib/utils";

export function Panel({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[var(--radius-card)] border border-border bg-surface p-4", className)}>
      {title && <h3 className="mb-3 text-sm font-medium text-muted">{title}</h3>}
      {children}
    </section>
  );
}

export function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      {children}
    </div>
  );
}

/** Designed insufficient state: hatched, never a zero (product rule 2). */
export function InsufficientState({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="status" className="hatched space-y-2 rounded-[var(--radius-card)] border border-border p-5">
      <p className="text-lg font-medium">{title}</p>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  );
}
