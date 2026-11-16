import { CalendarClock, CheckCheck, CheckCircle2, Circle, CircleDot, CircleHelp, Gauge, PencilLine } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { AcceptanceEditor } from "@/components/admin/acceptance-editor";
import { NotAllowed } from "@/components/admin/not-allowed";
import { getStaffRole } from "@/lib/admin";
import { RELEASE_DATE, acceptanceState, barGeometry, isAcceptanceSlug, projectMet, summariseAcceptance, type AcceptanceRow, type AcceptanceState } from "@/lib/acceptance";
import { cn } from "@/lib/utils";

// Icon + word + colour, never colour alone.
const STATE: Record<AcceptanceState, { Icon: typeof Circle; text: string }> = {
  met: { Icon: CheckCircle2, text: "text-expanding" },
  inProgress: { Icon: CircleDot, text: "text-consolidated" },
  notStarted: { Icon: Circle, text: "text-muted" },
  afterRelease: { Icon: CalendarClock, text: "text-muted" },
  notRecorded: { Icon: CircleHelp, text: "text-muted" },
};

export default async function AdminAcceptance({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, format, { supabase, role }] = await Promise.all([getTranslations("admin.acceptance"), getFormatter(), getStaffRole()]);
  if (!role) return <NotAllowed />;

  const { data, error } = await supabase.rpc("acceptance_progress");
  if (error?.code === "42501") return <NotAllowed />;
  if (error) throw error;
  const rows = [...((data ?? []) as AcceptanceRow[])].sort((a, b) => a.sort_order - b.sort_order);
  const summary = summariseAcceptance(rows);
  const releaseDate = format.dateTime(new Date(`${RELEASE_DATE}T00:00:00Z`), { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const n = (v: number) => format.number(v);

  return (
    <>
      <header className="page-header">
        <h1 className="t-h1">{t("title")}</h1>
        <p className="t-lead">{t("lead")}</p>
      </header>

      {rows.length === 0 ? (
        <div className="hatched space-y-1 rounded-[var(--radius-tile)] border border-border-strong/60 p-4" data-testid="acceptance-empty">
          <p className="font-medium">{t("emptyTitle")}</p>
          <p className="text-sm">{t("emptyBody")}</p>
        </div>
      ) : (
        <>
          <section className="card grid gap-4 p-4 sm:grid-cols-2 sm:p-6" aria-labelledby="acceptance-summary" data-testid="acceptance-summary">
            <div className="space-y-1">
              <h2 id="acceptance-summary" className="t-label">
                {t("summaryTitle")}
              </h2>
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="t-figure num text-4xl" data-testid="summary-met">
                  {n(summary.met)}
                </span>
                <span className="text-sm text-muted">{t("summaryMet", { due: summary.due })}</span>
              </p>
              {summary.afterRelease > 0 && <p className="text-sm text-muted">{t("summaryAfterRelease", { n: summary.afterRelease })}</p>}
            </div>
            <div className="space-y-1">
              <p className="t-label">{t("releaseLabel")}</p>
              <p className="t-h2 first-letter:uppercase" data-testid="release-date">
                {releaseDate}
              </p>
              <p className="text-sm text-muted">{t("projectNote")}</p>
            </div>
          </section>

          <ol className="space-y-3" data-testid="targets">
            {rows.map((row) => {
              const state = acceptanceState(row);
              const { Icon, text } = STATE[state];
              const label = locale === "en" ? row.label_en : row.label_it;
              const bar = barGeometry(row);
              const after = state === "afterRelease";
              const releaseText = after ? t("releaseAfter") : n(row.release_target);
              const valueText =
                row.current_value === null
                  ? t("notRecordedValue")
                  : after
                    ? t("ofProject", { value: n(row.current_value), target: n(row.project_target) })
                    : t("ofRelease", { value: n(row.current_value), target: n(row.release_target) });
              const beyond = projectMet(row) && (after || row.project_target > row.release_target);
              return (
                <li key={row.slug} className="card p-4 sm:p-6" data-testid="target" data-slug={row.slug} data-state={state}>
                  <div className="grid gap-5 lg:grid-cols-2 lg:gap-10">
                    <div className="space-y-3">
                      <h2 className="t-h2">{label}</h2>
                      <p className="flex flex-wrap gap-x-4 gap-y-1.5">
                        <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", text)} data-testid="state">
                          <Icon aria-hidden className="size-4" />
                          {t(`state.${state}`)}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-sm text-muted" data-testid="provenance">
                          {row.measured ? <Gauge aria-hidden className="size-4" /> : <PencilLine aria-hidden className="size-4" />}
                          {row.measured ? t("measured") : t("manual")}
                        </span>
                        {beyond && (
                          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-expanding">
                            <CheckCheck aria-hidden className="size-4" />
                            {t("projectMet")}
                          </span>
                        )}
                      </p>
                      {isAcceptanceSlug(row.slug) && (
                        <p className="text-sm leading-relaxed text-muted" data-testid="how">
                          <span className="font-medium text-text">{t("howLabel")}</span> {t(`how.${row.slug}`)}
                        </p>
                      )}
                      {!row.measured && row.manual_note && (
                        <p className="note" data-testid="manual-note">
                          <span className="t-label mb-0.5 block">{t("noteLabel")}</span>
                          <span className="break-words whitespace-pre-line">{row.manual_note}</span>
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      {row.current_value === null ? (
                        <p className="hatched inline-block rounded-[var(--radius-chip)] border border-border-strong/60 px-3 py-1.5 text-sm font-medium" data-testid="value-missing">
                          {t("notRecordedValue")}
                        </p>
                      ) : (
                        <p className="flex flex-wrap items-baseline gap-x-2">
                          <span className="t-figure num text-4xl" data-testid="value">
                            {n(row.current_value)}
                          </span>
                          <span className="num text-sm text-muted">{after ? t("ofProjectSuffix", { target: n(row.project_target) }) : t("ofReleaseSuffix", { target: n(row.release_target) })}</span>
                        </p>
                      )}

                      <div className="relative py-1.5">
                        <div
                          role="progressbar"
                          aria-label={label}
                          aria-valuemin={0}
                          aria-valuemax={Math.max(row.project_target, row.release_target)}
                          aria-valuenow={row.current_value ?? undefined}
                          aria-valuetext={valueText}
                          className={cn("h-2.5 overflow-hidden rounded-full", row.current_value === null ? "hatched" : "bg-surface-3")}
                        >
                          <div className={cn("h-full rounded-full", state === "met" || beyond ? "bg-expanding" : "bg-brand")} style={{ width: `${Math.max(bar.fill * 100, bar.fill > 0 ? 2 : 0)}%` }} />
                        </div>
                        {/* Markers: the release target inside the track, the 12-month target at its end. The legend below names both. */}
                        {bar.release !== null && <span aria-hidden data-testid="release-marker" className="absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-text" style={{ left: `${bar.release * 100}%` }} />}
                        <span aria-hidden data-testid="project-marker" className="absolute inset-y-0 right-0 w-0.5 rounded-full bg-text" />
                      </div>

                      <dl className="flex flex-wrap justify-between gap-x-6 gap-y-1 text-sm">
                        <div className="flex gap-1.5">
                          <dt className="text-muted">{t("releaseTarget")}</dt>
                          <dd className="num font-medium" data-testid="release-target">
                            {releaseText}
                          </dd>
                        </div>
                        <div className="flex gap-1.5">
                          <dt className="text-muted">{t("projectTarget")}</dt>
                          <dd className="num font-medium" data-testid="project-target">
                            {n(row.project_target)}
                          </dd>
                        </div>
                      </dl>

                      {role === "admin" && !row.measured && <AcceptanceEditor slug={row.slug} label={label} value={row.current_value} note={row.manual_note} />}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </>
  );
}
