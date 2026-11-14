import { useTranslations } from "next-intl";
import type { BriefContent } from "@/lib/ai/brief/types";
import { citedFacts } from "@/lib/advisor/content";
import { StatusLabel, type CellStatus } from "@/components/cell/status";
import { InsufficientState, Panel } from "@/components/sheet/ui";
import { CitedParagraph } from "./cited-text";
import { FactsList } from "./facts-list";

const CELL_STATUSES: readonly string[] = ["expanding", "consolidated", "threatened", "insufficient_data"];
const INPUTS: readonly string[] = ["trend", "geo", "csi", "competition"];
export const BRIEF_SCOPE = "brief";

/** Cell status, the rule behind it, what is missing and the representativeness note. */
export function BriefContext({ context }: { context: BriefContent["context"] }) {
  const t = useTranslations("briefs.context");
  const ti = useTranslations("inputs");
  const known = CELL_STATUSES.includes(context.status);
  return (
    <Panel title={t("title")}>
      <dl className="space-y-4 text-sm" data-testid="brief-context">
        <div>
          <dt className="t-label mb-1">{t("cellStatus")}</dt>
          <dd>{known ? <StatusLabel status={context.status as CellStatus} /> : context.status}</dd>
          {context.statusRule && <dd className="mt-1 leading-relaxed text-muted">{context.statusRule}</dd>}
        </div>
        <div>
          <dt className="t-label mb-1">{t("missingInputs")}</dt>
          {context.missingInputs.length ? (
            <dd>
              <ul className="flex flex-wrap gap-1.5">
                {context.missingInputs.map((m) => (
                  <li key={m} className="hatched rounded-full px-3 py-1 text-xs font-medium text-text">
                    {INPUTS.includes(m) ? ti(m) : m}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{t("missingHint")}</p>
            </dd>
          ) : (
            <dd className="text-muted">{t("noneMissing")}</dd>
          )}
        </div>
        {context.representativenessNote && (
          <div>
            <dt className="t-label mb-1">{t("representativeness")}</dt>
            <dd className="leading-relaxed">{context.representativenessNote}</dd>
          </div>
        )}
      </dl>
    </Panel>
  );
}

/** Sections with cited sentences, then the facts behind them. */
export function BriefBody({ content }: { content: BriefContent }) {
  const t = useTranslations("briefs");
  const sections = content.sections.filter((s) => s.sentences.length > 0);
  const facts = citedFacts(sections.flatMap((s) => s.sentences), content.facts);
  if (!sections.length) {
    return (
      <InsufficientState title={t("emptyVersionTitle")}>
        <p>{t("emptyVersionBody")}</p>
      </InsufficientState>
    );
  }
  return (
    <div className="space-y-4">
      <article className="card space-y-6 p-4 sm:p-7" data-testid="brief-body">
        {sections.map((s, i) => (
          <section key={i} className="space-y-2">
            <h2 className="t-h2">{s.heading}</h2>
            <CitedParagraph sentences={s.sentences} facts={content.facts} scope={BRIEF_SCOPE} className="max-w-[70ch]" />
          </section>
        ))}
      </article>
      {facts.length > 0 ? <FactsList facts={facts} scope={BRIEF_SCOPE} /> : <p className="note text-muted">{t("noFigures")}</p>}
    </div>
  );
}
