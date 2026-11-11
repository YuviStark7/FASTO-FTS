import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ActiveToggle } from "@/components/admin/active-toggle";
import { RerunButton } from "@/components/admin/rerun-button";
import { RunStatusLabel, type RunStatus } from "@/components/admin/run-status";
import { GradeBadge } from "@/components/cell/grade-badge";
import { getStaffRole } from "@/lib/admin";
import { CONNECTORS } from "@/pipelines/connectors";

export default async function AdminSources({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, format, { supabase, role }] = await Promise.all([getTranslations("admin"), getFormatter(), getStaffRole()]);
  if (!role) return null;

  const { data: sources, error } = await supabase.from("sources").select("*").order("name");
  if (error) throw error;
  const rows = await Promise.all(
    (sources ?? []).map(async (s) => {
      const { data } = await supabase
        .from("source_runs")
        .select("status, requested_at, rows_inserted, rows_rejected")
        .eq("source_id", s.id)
        .order("requested_at", { ascending: false })
        .limit(1);
      const { count } = await supabase
        .from("source_runs")
        .select("id", { count: "exact", head: true })
        .eq("source_id", s.id)
        .in("status", ["queued", "running"]);
      return { s, last: data?.[0] ?? null, busy: (count ?? 0) > 0 };
    }),
  );

  return (
    <>
      <h1 className="text-4xl font-light tracking-tight">{t("sources.title")}</h1>
      {rows.length === 0 ? (
        <p className="hatched rounded-[var(--radius-card)] p-6 text-muted">{t("sources.empty")}</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {rows.map(({ s, last, busy }) => (
            <li key={s.id} className="space-y-4 rounded-[var(--radius-card)] bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-medium">{s.name}</h2>
                <span className="inline-flex items-center gap-2 text-sm text-muted">
                  {t("sources.grade")} <GradeBadge grade={s.default_grade} />
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted">{t("sources.licence")}</dt>
                  <dd>{s.licence ?? t("sources.noLicence")}</dd>
                </div>
                <div>
                  <dt className="text-muted">{t("sources.terms")}</dt>
                  <dd className="num">
                    {s.terms_verified_at ? format.dateTime(new Date(s.terms_verified_at), { dateStyle: "medium" }) : t("sources.termsMissing")}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">{t("sources.active")}</dt>
                  <dd>
                    {role === "admin" ? <ActiveToggle sourceId={s.id} name={s.name} active={s.is_active} /> : s.is_active ? t("sources.yes") : t("sources.no")}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">{t("sources.lastRun")}</dt>
                  <dd className="space-y-0.5">
                    {last ? (
                      <>
                        <RunStatusLabel status={last.status as RunStatus} />
                        <span className="num block text-muted">{format.dateTime(new Date(last.requested_at), { dateStyle: "short", timeStyle: "short" })}</span>
                        <span className="num block text-muted">
                          {t("sources.written", { n: last.rows_inserted ?? 0 })} · {t("sources.rejected", { n: last.rows_rejected ?? 0 })}
                        </span>
                      </>
                    ) : (
                      t("sources.noRun")
                    )}
                  </dd>
                </div>
              </dl>
              {(CONNECTORS as readonly string[]).includes(s.slug) ? (
                <RerunButton sourceId={s.id} name={s.name} busy={busy} />
              ) : (
                <p className="text-sm text-muted">{t("sources.noConnector")}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
