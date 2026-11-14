import { ChevronRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BriefStatusLabel } from "@/components/advisor/brief-status";
import { DemoBadge } from "@/components/cell/grade-badge";
import { formatDate } from "@/components/sheet/format";
import { getStaffRole } from "@/lib/admin";
import { Link } from "@/lib/i18n/navigation";
import { listBriefs } from "@/lib/queries/briefs";

export default async function BriefsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, { role }, briefs] = await Promise.all([getTranslations("briefs"), getStaffRole(), listBriefs(locale)]);

  return (
    <div className="page max-w-4xl space-y-6">
      <header className="page-header">
        <h1 className="t-h1">{t("title")}</h1>
        <p className="t-lead">{t("lead")}</p>
      </header>

      {briefs.length === 0 ? (
        <div className="hatched overflow-hidden rounded-[var(--radius-card)] border border-border-strong/60" data-testid="briefs-empty">
          <div className="m-1.5 space-y-2 rounded-[14px] bg-surface p-5 sm:p-6">
            <h2 className="t-h2">{t("emptyTitle")}</h2>
            <p className="text-sm leading-relaxed">{role ? t("emptyBodyStaff") : t("emptyBody")}</p>
            <Link href="/" className="btn btn-ghost mt-2">{t("emptyAction")}</Link>
          </div>
        </div>
      ) : (
        <ul className="space-y-3" data-testid="briefs-list">
          {briefs.map((b) => (
            <li key={b.id}>
              <Link href={`/briefs/${b.id}`} className="card card-link group flex items-center gap-4 p-4 sm:px-6 sm:py-5" data-testid="brief-row">
                <span className="min-w-0 flex-1 space-y-1.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="t-h2">{t("cell", { category: b.category, territory: b.territory })}</span>
                    {b.isDemo && <DemoBadge />}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                    <BriefStatusLabel status={b.status} className="text-text" />
                    <span className="num">{b.version != null ? t("version", { n: b.version }) : t("noVersion")}</span>
                    <span className="num">{formatDate(b.date, locale)}</span>
                    {b.versionLocale && <span className="uppercase">{b.versionLocale}</span>}
                  </span>
                </span>
                <ChevronRight aria-hidden className="size-4 shrink-0 text-muted transition-transform duration-(--dur-base) group-hover:translate-x-0.5 group-hover:text-text" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
