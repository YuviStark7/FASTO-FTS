"use client";
import { CircleCheck, CircleX, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { runReferenceQuestions } from "@/app/[locale]/(app)/ask/actions";

type Results = Awaited<ReturnType<typeof runReferenceQuestions>>["results"];

/** Runs the ten reference questions (SPEC section 10, Day 4 gate) and shows pass or fail with the reasons. */
export function AskEvalRunner() {
  const t = useTranslations("askEval");
  const [pending, start] = useTransition();
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<"refused" | "failed" | null>(null);
  const passed = results?.filter((r) => r.passed).length ?? 0;

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <button
          type="button"
          disabled={pending}
          aria-busy={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              try {
                const r = await runReferenceQuestions();
                if (r.ok) setResults(r.results);
                else setError("refused");
              } catch {
                setError("failed");
              }
            })
          }
          className="btn btn-primary"
        >
          <Play aria-hidden className="size-4" />
          {pending ? t("running") : results ? t("runAgain") : t("run")}
        </button>
        <p className="t-meta">{pending ? t("runningHint") : t("cost")}</p>
      </div>

      {error && <p role="alert" className="note">{t(`errors.${error}`)}</p>}

      {pending && (
        <div role="status" aria-busy="true" className="space-y-3">
          <div className="skeleton h-24 rounded-[var(--radius-card)]" />
          <div className="skeleton h-24 rounded-[var(--radius-card)]" />
          <span className="sr-only">{t("running")}</span>
        </div>
      )}

      {!pending && !results && !error && (
        <div className="hatched overflow-hidden rounded-[var(--radius-card)] border border-border-strong/60" data-testid="ask-eval-empty">
          <div className="m-1.5 space-y-1.5 rounded-[14px] bg-surface p-5">
            <h2 className="t-h2">{t("emptyTitle")}</h2>
            <p className="text-sm leading-relaxed">{t("emptyBody")}</p>
          </div>
        </div>
      )}

      {!pending && results && (
        <>
          <p className="t-h2 num" role="status" data-testid="ask-eval-summary">{t("summary", { passed, total: results.length })}</p>
          <ol className="space-y-3">
            {results.map((r) => (
              <li key={r.id} className="card space-y-3 p-4 sm:px-6 sm:py-5" data-testid="ask-eval-row">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <span className="num t-label mt-1 w-6">{r.id}</span>
                  <p className="min-w-0 flex-1 basis-56 font-medium">{r.question}</p>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                    {r.passed ? <CircleCheck aria-hidden className="size-4 text-expanding" /> : <CircleX aria-hidden className="size-4 text-threatened" />}
                    {r.passed ? t("passed") : t("failed")}
                  </span>
                </div>
                {r.reasons.length > 0 && (
                  <div>
                    <h3 className="t-label mb-1">{t("reasons")}</h3>
                    <ul className="list-disc space-y-0.5 pl-5 text-sm">
                      {r.reasons.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <h3 className="t-label mb-1">{t("answer")}</h3>
                  {r.answer ? <p className="border-l-2 border-border-strong pl-3 text-sm leading-relaxed">{r.answer}</p> : <p className="text-sm text-muted">{t("noAnswer")}</p>}
                </div>
              </li>
            ))}
          </ol>
          <p className="text-xs leading-relaxed text-muted">{t("rawNote")}</p>
        </>
      )}
    </div>
  );
}
