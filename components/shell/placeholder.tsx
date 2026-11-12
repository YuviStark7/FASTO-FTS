export function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
      <div aria-hidden className="hatched h-28 w-20 rounded-[var(--radius-card)] border border-border-strong/60 shadow-e2" />
      <h1 className="t-display">{title}</h1>
      <p className="t-lead">{body}</p>
    </div>
  );
}
