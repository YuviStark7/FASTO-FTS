export function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div aria-hidden className="hatched h-28 w-20 rounded-[var(--radius-card)]" />
      <h1 className="text-4xl font-light tracking-tight">{title}</h1>
      <p className="text-muted">{body}</p>
    </div>
  );
}
