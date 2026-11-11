import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { RunStatusLabel, type RunStatus } from "@/components/admin/run-status";
import { getStaffRole } from "@/lib/admin";
import { Link } from "@/lib/i18n/navigation";

type ErrorLine = { reason?: string; ref?: string };

function errorLines(errors: unknown): ErrorLine[] {
  if (!Array.isArray(errors)) return [];
  return errors.map((e) =>
    e && typeof e === "object"
      ? { reason: String((e as ErrorLine).reason ?? ""), ref: (e as ErrorLine).ref ? String((e as ErrorLine).ref) : undefined }
      : { reason: String(e) },
  );
}

export default async function AdminRuns({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, format, { supabase, role }] = await Promise.all([getTranslations("admin"), getFormatter(), getStaffRole()]);
  if (!role) return null;

  const { data, error } = await supabase
    .from("source_runs")
    .select("id, status, requested_at, started_at, finished_at, rows_fetched, rows_inserted, rows_rejected, errors, sources(name)")
    .order("requested_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  const runs = data ?? [];
  const live = runs.some((r) => r.status === "queued" || r.status === "running");

  const duration = (start: string | null, end: string | null) => {
    if (!start || !end) return t("runs.noDuration");
    const s = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
    return s < 90 ? t("runs.seconds", { n: s }) : t("runs.minutes", { n: Math.round(s / 60) });
  };
  const n = (v: number | null) => (v === null ? "–" : format.number(v));

  return (
    <>
      <h1 className="text-4xl font-light tracking-tight">{t("runs.title")}</h1>
      {live && <AutoRefresh />}
      {runs.length === 0 ? (
        <div className="hatched space-y-3 rounded-[var(--radius-card)] p-6">
          <h2 className="text-xl font-medium">{t("runs.emptyTitle")}</h2>
          <p className="text-muted">{t("runs.emptyBody")}</p>
          <Link href="/admin/sources" className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-medium text-brand-contrast">
            {t("runs.emptyAction")}
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {runs.map((r) => {
            const lines = errorLines(r.errors);
            return (
              <li key={r.id} className="space-y-3 rounded-[var(--radius-card)] bg-surface p-4" data-testid="run">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-medium">{r.sources?.name}</h2>
                  <RunStatusLabel status={r.status as RunStatus} />
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
                  <div>
                    <dt className="text-muted">{t("runs.requestedAt")}</dt>
                    <dd className="num">{format.dateTime(new Date(r.requested_at), { dateStyle: "short", timeStyle: "short" })}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t("runs.duration")}</dt>
                    <dd className="num">{duration(r.started_at, r.finished_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t("runs.fetched")}</dt>
                    <dd className="num">{n(r.rows_fetched)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t("runs.written")}</dt>
                    <dd className="num">{n(r.rows_inserted)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t("runs.rejected")}</dt>
                    <dd className="num">{n(r.rows_rejected)}</dd>
                  </div>
                </dl>
                {lines.length > 0 ? (
                  <details className="text-sm">
                    <summary className="flex min-h-11 cursor-pointer items-center">{t("runs.errors", { n: lines.length })}</summary>
                    <ul className="space-y-1 pb-2">
                      {lines.map((l, i) => (
                        <li key={i} className="break-words">
                          {l.reason}
                          {l.ref && <span className="num text-muted"> ({l.ref})</span>}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <p className="text-sm text-muted">{t("runs.noErrors")}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
