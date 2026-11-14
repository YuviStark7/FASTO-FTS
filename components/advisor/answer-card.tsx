import { CircleDashed, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { StoredAnswer } from "@/lib/advisor/content";
import { CitedParagraph } from "./cited-text";
import { FactsList } from "./facts-list";

/**
 * One assistant answer. "passed": every figure matched a cited fact, listed below with its grade.
 * "unavailable": the hatched, insufficient-data treatment; nothing in it is a figure.
 */
export function AnswerCard({ answer, scope, onFollowUp, disabled }: { answer: StoredAnswer; scope: string; onFollowUp?: (q: string) => void; disabled?: boolean }) {
  const t = useTranslations("ask");
  if (answer.checked === "unavailable") {
    return (
      <div role="status" data-testid="answer-unavailable" className="hatched overflow-hidden rounded-[var(--radius-card)] border border-border-strong/60 shadow-e1">
        <div className="m-1.5 space-y-2 rounded-[14px] bg-surface p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <CircleDashed aria-hidden strokeWidth={1.5} className="size-5 shrink-0" />
            {t("unavailable")}
          </p>
          <p className="text-sm leading-relaxed">{answer.sentences.map((s) => s.text).join(" ")}</p>
          <p className="text-xs text-muted">{t("unavailableHint")}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="card space-y-4 p-4 sm:p-5" data-testid="answer">
      <CitedParagraph sentences={answer.sentences} facts={answer.facts} scope={scope} />
      <p className="flex items-center gap-1.5 text-xs font-medium text-expanding" data-testid="answer-checked">
        <ShieldCheck aria-hidden className="size-4 shrink-0" />
        <span className="text-text">{answer.facts.length ? t("checked") : t("checkedNoFigures")}</span>
      </p>
      <FactsList facts={answer.facts} scope={scope} compact />
      {onFollowUp && answer.followUps.length > 0 && (
        <div>
          <h3 className="t-label mb-2">{t("followUps")}</h3>
          <ul className="flex flex-wrap gap-2">
            {answer.followUps.map((q) => (
              <li key={q}>
                <button type="button" disabled={disabled} onClick={() => onFollowUp(q)} className="btn btn-ghost h-auto min-h-11 px-4 py-2 text-left leading-snug whitespace-normal">
                  {q}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
