import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { DemoBadge, GradeBadge } from "@/components/cell/grade-badge";
import { NotAllowed } from "@/components/admin/not-allowed";
import { getStaffRole } from "@/lib/admin";

export default async function AdminFeedback({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, format, { supabase, role }] = await Promise.all([getTranslations("feedback"), getFormatter(), getStaffRole()]);
  // The rpc is admin only (it raises 42501 otherwise): analysts get the same not-allowed state.
  if (role !== "admin") return <NotAllowed />;

  const [{ data, error }, cats, terrs] = await Promise.all([
    supabase.rpc("feedback_summary"),
    supabase.from("categories").select("slug, name_it, name_en"),
    supabase.from("territories").select("slug, name_it, name_en"),
  ]);
  if (error) throw error;
  const name = (rows: { slug: string; name_it: string; name_en: string }[] | null, slug: string) => {
    const r = rows?.find((x) => x.slug === slug);
    return r ? (locale === "en" ? r.name_en : r.name_it) : slug;
  };
  const items = data ?? [];

  return (
    <>
      <h1 className="t-h1">{t("adminTitle")}</h1>
      <p className="t-label num" data-testid="control-cases">{t("controlCases", { count: items.length })}</p>
      {items.length === 0 ? (
        <div className="hatched space-y-2 rounded-[var(--radius-card)] border border-border-strong/60 p-6">
          <h2 className="t-h2">{t("emptyTitle")}</h2>
          <p>{t("emptyBody")}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r.csi_snapshot_id} className="card space-y-4 p-4 sm:px-6 sm:py-5" data-testid="feedback-case">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="t-h2">
                  {name(cats.data, r.category_slug)}, {name(terrs.data, r.territory_slug)}
                </h2>
                <span className="num">{t("csiOf", { value: Math.round(r.csi), n: r.n_mentions })}</span>
                <GradeBadge grade="C" />
                {r.is_demo && <DemoBadge />}
                <span className="text-sm text-muted">{t("computed", { date: format.dateTime(new Date(r.computed_at), { dateStyle: "medium" }) })}</span>
              </div>
              <ul className="flex flex-wrap gap-2 text-sm">
                <li className="rounded-full bg-surface-2 px-3.5 py-1.5">{t("right")}: <span className="num">{r.n_right}</span></li>
                <li className="rounded-full bg-surface-2 px-3.5 py-1.5">{t("partly_right")}: <span className="num">{r.n_partly_right}</span></li>
                <li className="rounded-full bg-surface-2 px-3.5 py-1.5">{t("wrong")}: <span className="num">{r.n_wrong}</span></li>
              </ul>
              <div>
                <h3 className="t-label mb-1.5">{t("commentsTitle")}</h3>
                {r.comments.length === 0 ? (
                  <p className="text-sm text-muted">{t("noComments")}</p>
                ) : (
                  <ul className="mt-1 space-y-1.5">
                    {r.comments.map((c, i) => (
                      <li key={i} className="border-l-2 border-border-strong pl-3 text-sm leading-relaxed">“{c}”</li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
