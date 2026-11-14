import { ArrowLeft, CircleAlert, CircleCheck, FileText, Printer } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BriefBody, BriefContext } from "@/components/advisor/brief-body";
import { BriefStatusLabel } from "@/components/advisor/brief-status";
import { GenerateBriefButton } from "@/components/advisor/generate-brief-button";
import { ReviewControls, type ReviewAction } from "@/components/advisor/review-controls";
import { DemoBadge } from "@/components/cell/grade-badge";
import { FeedbackControl } from "@/components/feedback/feedback-control";
import { formatDate } from "@/components/sheet/format";
import { InsufficientState, Panel } from "@/components/sheet/ui";
import { danglingCitations } from "@/lib/advisor/content";
import { DocumentLink } from "@/components/advisor/document-link";
import { Link } from "@/lib/i18n/navigation";
import { getBriefDetail, getViewer } from "@/lib/queries/briefs";

// Regenerating a brief runs inside a server action of this route: 20 to 60 seconds.
export const maxDuration = 120;

export default async function BriefPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ v?: string }> }) {
  const [{ locale, id }, { v }] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const loc = locale === "en" ? "en" : "it";
  const [t, viewer] = await Promise.all([getTranslations("briefs"), getViewer()]);
  const wanted = v && /^\d+$/.test(v) ? Number(v) : null;
  const brief = /^\d+$/.test(id) ? await getBriefDetail(Number(id), wanted, viewer.isStaff) : null;
  if (!brief) notFound();

  const { selected, status } = brief;
  const name = (x: { name_it: string; name_en: string }) => (loc === "en" ? x.name_en : x.name_it);
  const isCurrent = selected != null && selected.id === brief.currentVersionId;
  const current = brief.versions.find((x) => x.id === brief.currentVersionId);
  const content = selected?.content ?? null;
  const dangling = content ? danglingCitations(content.sections.flatMap((s) => s.sentences), content.facts) : [];
  const exportable = selected != null && content != null && selected.citationCheckPassed && dangling.length === 0 && viewer.writeOrgId != null;
  const query = selected && !isCurrent ? `?v=${selected.id}` : "";

  const actions: ReviewAction[] = [];
  if (viewer.isStaff && current) {
    if (status === "draft") actions.push({ key: "markReviewed", status: "reviewed", primary: viewer.role !== "admin" });
    if (status === "reviewed") actions.push({ key: "backToDraft", status: "draft" });
    if (viewer.role === "admin") {
      if (status === "published") actions.push({ key: "unpublish", status: "reviewed" });
      else actions.push({ key: "publish", status: "published", primary: true, blocked: current.citationCheckPassed ? undefined : "citation" });
    }
  }

  return (
    <div className="page max-w-6xl space-y-6">
      <Link href="/briefs" className="link inline-flex min-h-11 items-center gap-1.5 text-sm">
        <ArrowLeft aria-hidden className="size-4" />
        {t("back")}
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="t-h1">{t("cell", { category: name(brief.category), territory: name(brief.territory) })}</h1>
          {content?.context.isDemo && <DemoBadge />}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <BriefStatusLabel status={status} className="text-text" />
          {selected && (
            <>
              <span className="num" data-testid="brief-version">{t("version", { n: selected.version })}</span>
              <span className="num">{t("generatedOn", { date: formatDate(selected.createdAt, locale) })}</span>
              <span className="uppercase">{selected.locale}</span>
            </>
          )}
        </div>
        {selected && !isCurrent && (
          <p className="note flex items-start gap-2" data-testid="not-current">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-threatened" />
            <span>
              {t("notCurrent", { n: selected.version })}{" "}
              <DocumentLink href={`/briefs/${brief.id}`} className="link">{t("seeCurrent")}</DocumentLink>
            </span>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {exportable && (
            <>
              <DocumentLink href={`/briefs/${brief.id}/print${query}`} className="btn btn-ghost px-4">
                <Printer aria-hidden className="size-4" />
                {t("export.pdf")}
              </DocumentLink>
              <DocumentLink href={`/briefs/${brief.id}/docx${query}`} download className="btn btn-ghost px-4">
                <FileText aria-hidden className="size-4" />
                {t("export.word")}
              </DocumentLink>
            </>
          )}
          <Link href={`/cell/${brief.category.slug}/${brief.territory.slug}`} className="btn btn-quiet px-4">{t("openCell")}</Link>
        </div>
        {selected && content && !exportable && (
          <p className="text-sm text-muted" data-testid="export-refused">{viewer.writeOrgId == null ? t("export.viewer") : t("export.refusedBody")}</p>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0 space-y-4">
          {!selected ? (
            <InsufficientState title={t("noVersionTitle")}>
              <p>{t("noVersionBody")}</p>
            </InsufficientState>
          ) : !content ? (
            <InsufficientState title={t("unreadableTitle")}>
              <p>{t("unreadableBody")}</p>
            </InsufficientState>
          ) : (
            <>
              {dangling.length > 0 && (
                <p role="alert" className="note flex items-start gap-2">
                  <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-threatened" />
                  {t("dangling", { ids: dangling.join(", ") })}
                </p>
              )}
              <BriefBody content={content} />
              <div className="lg:hidden">
                <BriefContext context={content.context} />
              </div>
              <div className="card px-4 pb-4 sm:px-6 sm:pb-5 [&>div]:mt-0 [&>div]:border-t-0">
                <FeedbackControl targetType="brief_version" targetId={selected.id} />
              </div>
            </>
          )}
        </div>

        <aside className="space-y-4">
          {content && (
            <div className="hidden lg:block">
              <BriefContext context={content.context} />
            </div>
          )}

          {viewer.isStaff && (
            <Panel title={t("review.title")}>
              <div className="space-y-4" data-testid="staff-panel">
                {selected && (
                  <p className="flex items-start gap-2 text-sm" data-testid="citation-check">
                    {selected.citationCheckPassed ? <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-expanding" /> : <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-threatened" />}
                    {selected.citationCheckPassed ? t("review.checkPassed") : t("review.checkFailed")}
                  </p>
                )}
                {content && (
                  <div className="text-sm" data-testid="dropped">
                    <p>{t("review.dropped", { count: content.dropped.length })}</p>
                    {content.dropped.length > 0 && (
                      <details className="mt-1.5">
                        <summary className="link min-h-11 cursor-pointer content-center text-sm">{t("review.droppedShow")}</summary>
                        <ul className="mt-1 space-y-2">
                          {content.dropped.map((d, i) => (
                            <li key={i} className="border-l-2 border-border-strong pl-3 text-xs leading-relaxed">
                              <span className="line-through decoration-muted">{d.text}</span>
                              <span className="mt-0.5 block text-muted">{d.reason}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-xs text-muted">{t("review.droppedNote")}</p>
                      </details>
                    )}
                  </div>
                )}
                <ReviewControls briefId={brief.id} actions={actions} />
                {viewer.role === "analyst" && status === "published" && <p className="text-sm text-muted">{t("review.publishedAnalyst")}</p>}
                <div className="border-t border-border pt-4">
                  <GenerateBriefButton category={brief.category.slug} territory={brief.territory.slug} locale={loc} refresh />
                </div>
              </div>
            </Panel>
          )}

          {viewer.isStaff && brief.versions.length > 0 && (
            <Panel title={t("history.title")}>
              <ol className="space-y-3" data-testid="version-history">
                {brief.versions.map((ver) => {
                  const viewing = ver.id === selected?.id;
                  const cur = ver.id === brief.currentVersionId;
                  return (
                    <li key={ver.id} className="space-y-2 border-b border-border pb-3 last:border-b-0 last:pb-0" data-testid="version-row">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className="num font-medium">{t("version", { n: ver.version })}</span>
                        <span className="num text-muted">{formatDate(ver.createdAt, locale)}</span>
                        <span className="text-muted uppercase">{ver.locale}</span>
                        {cur && <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium">{t("history.current")}</span>}
                      </div>
                      <p className="flex items-center gap-1.5 text-xs text-muted">
                        {ver.citationCheckPassed ? <CircleCheck aria-hidden className="size-3.5 text-expanding" /> : <CircleAlert aria-hidden className="size-3.5 text-threatened" />}
                        {ver.citationCheckPassed ? t("history.checkPassed") : t("history.checkFailed")}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {viewing ? (
                          <span className="text-sm text-muted" aria-current="true">{t("history.viewing")}</span>
                        ) : (
                          <DocumentLink href={cur ? `/briefs/${brief.id}` : `/briefs/${brief.id}?v=${ver.id}`} className="btn btn-quiet px-4" aria-label={t("history.viewLabel", { n: ver.version })}>
                            {t("history.view")}
                          </DocumentLink>
                        )}
                        {viewer.role === "admin" && !(cur && status === "published") && (
                          <ReviewControls
                            briefId={brief.id}
                            actions={[{ key: "publishVersion", status: "published", versionId: ver.id, blocked: ver.citationCheckPassed ? undefined : "citation" }]}
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}
