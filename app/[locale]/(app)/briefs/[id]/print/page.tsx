import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PrintButton } from "@/components/advisor/print-button";
import { GradeBadge } from "@/components/cell/grade-badge";
import { InsufficientState } from "@/components/sheet/ui";
import { citedFacts } from "@/lib/advisor/content";
import { factReference } from "@/lib/export/brief-docx";
import { buildBriefDocMeta } from "@/lib/export/brief-meta";
import { DocumentLink } from "@/components/advisor/document-link";
import { getExportable } from "@/lib/queries/briefs";
import "./print.css";

export default async function BriefPrintPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ v?: string }> }) {
  const [{ locale, id }, { v }] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const loc = locale === "en" ? "en" : "it";
  const t = await getTranslations("briefs");
  const valid = /^\d+$/.test(id);
  const x = valid ? await getExportable(Number(id), v && /^\d+$/.test(v) ? Number(v) : null) : ({ ok: false, reason: "not_found" } as const);
  const back = valid && (x.ok || x.reason !== "not_found") ? `/briefs/${id}${v && /^\d+$/.test(v) ? `?v=${v}` : ""}` : "/briefs";

  if (!x.ok) {
    return (
      <div className="page max-w-2xl space-y-4" data-testid="export-refused">
        <DocumentLink href={back} className="link inline-flex min-h-11 items-center gap-1.5 text-sm">
          <ArrowLeft aria-hidden className="size-4" />
          {t("export.back")}
        </DocumentLink>
        <InsufficientState title={t("export.refusedTitle")}>
          <p>{t(`export.refused.${x.reason}`)}</p>
        </InsufficientState>
      </div>
    );
  }

  const meta = await buildBriefDocMeta(x, loc);
  const { content, version, detail } = x;
  const sections = content.sections.filter((s) => s.sentences.length > 0);
  const facts = citedFacts(sections.flatMap((s) => s.sentences), content.facts);
  const c = meta.columns;

  return (
    <div className="print-page page max-w-5xl space-y-4">
      <div className="print-hide flex flex-wrap items-center justify-between gap-3">
        <DocumentLink href={back} className="link inline-flex min-h-11 items-center gap-1.5 text-sm">
          <ArrowLeft aria-hidden className="size-4" />
          {t("export.back")}
        </DocumentLink>
        <PrintButton briefId={detail.id} versionId={version.id} />
      </div>
      <p className="print-hide text-sm text-muted">{t("export.printHint")}</p>

      <article data-theme="light" className="print-sheet" data-testid="print-sheet">
        {meta.demoLabel && (
          <div aria-hidden className="print-watermark" data-testid="demo-watermark">
            {meta.demoLabel}
          </div>
        )}
        <header>
          <h1>{meta.title}</h1>
          {meta.demoLabel && <p className="mt-2"><span className="demo">{meta.demoLabel}</span> <span className="text-xs">{t("export.demoNote")}</span></p>}
          <dl className="print-meta" data-testid="print-meta">
            {meta.header.map((h) => (
              <div key={h.label}>
                <dt>{h.label}</dt>
                <dd className="num">{h.value}</dd>
              </div>
            ))}
          </dl>
        </header>

        {sections.map((s, i) => (
          <section key={i}>
            <h2>{s.heading}</h2>
            <p>
              {s.sentences.map((sentence, j) => (
                <span key={j}>
                  {sentence.text}
                  {sentence.facts.length > 0 && <sup data-testid="print-marker">[{sentence.facts.join(", ")}]</sup>}{" "}
                </span>
              ))}
            </p>
          </section>
        ))}

        <section>
          <h2>{meta.contextTitle}</h2>
          <dl className="space-y-1 text-[0.92em]">
            {meta.context.map((r) => (
              <div key={r.label}>
                <dt className="inline font-semibold">{r.label}: </dt>
                <dd className="inline">{r.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2>{meta.sourcesTitle}</h2>
          <div className="print-table-wrap">
            <table className="print-table" data-testid="sources-table">
              <thead>
                <tr>
                  {[c.id, c.label, c.value, c.grade, c.period, c.method, c.source, c.reference].map((h) => (
                    <th key={h} scope="col">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {facts.map((f) => (
                  <tr key={f.id} data-testid="sources-row">
                    <th scope="row" className="num">{f.id}</th>
                    <td>{f.label}</td>
                    <td className="num whitespace-nowrap">{f.display}</td>
                    <td>
                      {f.grade ? (
                        <span className="inline-flex items-center gap-1.5">
                          <GradeBadge grade={f.grade} />
                          {meta.gradeNames[f.grade]}
                        </span>
                      ) : (
                        meta.noGrade
                      )}
                    </td>
                    <td className="num">{f.period}</td>
                    <td>{f.method}</td>
                    <td>{f.source}</td>
                    <td className="num break-all">{factReference(f)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[0.8em] text-muted">{meta.footer}</p>
        </section>
      </article>
    </div>
  );
}
