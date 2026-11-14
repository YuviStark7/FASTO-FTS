import { ChevronRight, Plus } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CategoryIcon } from "@/components/cell/category-icon";
import { formatDate } from "@/components/sheet/format";
import { Link } from "@/lib/i18n/navigation";
import { getPassportScreen } from "@/lib/queries/passports";

export default async function PassportPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ deleted?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, { passports, canCreate }, query] = await Promise.all([getTranslations("passport"), getPassportScreen(), searchParams]);
  const name = (x: { name_it: string; name_en: string }) => (locale === "en" ? x.name_en : x.name_it);

  const create = canCreate && (
    <Link href="/passport/new" className="btn btn-primary max-sm:w-full" data-testid="passport-new">
      <Plus aria-hidden className="size-4" />
      {t("list.new")}
    </Link>
  );

  return (
    <div className="page max-w-4xl space-y-6">
      <header className="page-header">
        <h1 className="t-h1">{t("title")}</h1>
        <p className="t-lead">{t("lead")}</p>
      </header>

      {query.deleted === "1" && (
        <p role="status" className="note">
          {t("form.deleted")}
        </p>
      )}
      {!canCreate && (
        <p role="status" className="note" data-testid="passport-readonly">
          {t("list.viewer")}
        </p>
      )}

      {passports.length === 0 ? (
        <div className="card space-y-3 p-5 sm:p-6" data-testid="passport-empty">
          <h2 className="t-h2">{t("list.emptyTitle")}</h2>
          <p className="max-w-[65ch] text-sm leading-relaxed text-muted">{canCreate ? t("list.emptyBody") : t("list.emptyViewer")}</p>
          {create && <div className="pt-1">{create}</div>}
        </div>
      ) : (
        <>
          <ul className="space-y-3" aria-label={t("list.label")} data-testid="passport-list">
            {passports.map((p) => (
              <li key={p.id}>
                <Link href={`/passport/${p.id}`} className="card card-link group flex items-center gap-4 p-4 sm:px-6 sm:py-5" data-testid="passport-row">
                  <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-[12px] text-on-category" style={{ backgroundColor: p.category.color }}>
                    <CategoryIcon name={p.category.icon} className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="t-h2 block truncate">{p.name}</span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                      <span className="text-text">{name(p.category)}</span>
                      <span>{p.priceBand ? t(`bands.${p.priceBand}`) : t("list.noBand")}</span>
                      {p.certifications.length > 0 && <span>{p.certifications.join(", ")}</span>}
                      <span className="num">{t("list.claims", { count: p.claims.length })}</span>
                      <span className="num">{t("list.updated", { date: formatDate(p.updatedAt, locale) })}</span>
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-muted transition-transform duration-(--dur-base) group-hover:translate-x-0.5 group-hover:text-text" />
                </Link>
              </li>
            ))}
          </ul>
          {create}
        </>
      )}
    </div>
  );
}
