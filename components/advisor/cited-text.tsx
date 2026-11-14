"use client";
import { useTranslations } from "next-intl";
import type { Fact } from "@/lib/ai/brief/types";
import { factAnchor } from "@/lib/advisor/anchor";
import type { Sentence } from "@/lib/advisor/content";
import { cn } from "@/lib/utils";

const GRADE_RING = {
  A: "border-text bg-text text-bg",
  B: "border-text text-text",
  C: "border-dotted border-muted text-muted",
} as const;

/**
 * Superscript citation marker. Carries the fact id and its grade letter (A solid, B outlined,
 * C dotted, like the grade badge), and moves focus to the fact in the list of the same scope.
 * A marker with no fact behind it is shown hatched: unknown, never silently dropped.
 */
export function FactChip({ id, fact, scope }: { id: string; fact: Fact | undefined; scope: string }) {
  const t = useTranslations("advisor");
  const g = useTranslations("grade");
  if (!fact) {
    return (
      <sup className="mx-0.5 align-super">
        <span className="hatched num rounded-[5px] px-1 py-px text-[10px] font-semibold text-text" title={t("chipMissing", { id })}>
          {id}
        </span>
      </sup>
    );
  }
  const grade = fact.grade;
  return (
    <sup className="mx-0.5 align-super">
      <a
        href={`#${factAnchor(scope, id)}`}
        data-testid="fact-chip"
        aria-label={t("chipLabel", { id, label: fact.label, value: fact.display, grade: grade ? g(grade) : t("noGrade") })}
        title={`${fact.label}: ${fact.display}`}
        onClick={(e) => {
          const el = document.getElementById(factAnchor(scope, id));
          if (!el) return;
          e.preventDefault();
          const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          el.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
          el.focus({ preventScroll: true });
        }}
        className={cn(
          "num relative inline-flex items-center gap-1 rounded-[5px] border px-1 py-px text-[10px] leading-3.5 font-semibold no-underline transition-transform duration-(--dur-fast) hover:-translate-y-px",
          // Enlarged hit area without moving the text around it.
          "before:absolute before:-inset-x-1.5 before:-inset-y-3 before:content-['']",
          grade ? GRADE_RING[grade] : "hatched border-border-strong text-text",
        )}
      >
        {id}
        {grade && <span aria-hidden>{grade}</span>}
      </a>
    </sup>
  );
}

/** One sentence followed by the markers of the facts it cites. */
export function CitedSentence({ sentence, facts, scope }: { sentence: Sentence; facts: Map<string, Fact>; scope: string }) {
  return (
    <span data-testid="cited-sentence">
      {sentence.text}
      {sentence.facts.map((id) => (
        <FactChip key={id} id={id} fact={facts.get(id)} scope={scope} />
      ))}{" "}
    </span>
  );
}

/** A run of sentences as one paragraph. */
export function CitedParagraph({ sentences, facts, scope, className }: { sentences: Sentence[]; facts: Fact[]; scope: string; className?: string }) {
  const byId = new Map(facts.map((f) => [f.id, f]));
  return (
    <p className={cn("leading-relaxed", className)}>
      {sentences.map((s, i) => (
        <CitedSentence key={i} sentence={s} facts={byId} scope={scope} />
      ))}
    </p>
  );
}
