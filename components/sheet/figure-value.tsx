"use client";
import { useEffect, useId, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { X } from "lucide-react";
import type { Figure } from "@/lib/queries/cell";
import { GradeBadge } from "@/components/cell/grade-badge";
import { cn } from "@/lib/utils";
import { formatValue } from "./format";
import { useSheet } from "./sheet-context";

const FLAGS = ["p", "e", "b", "d"] as const;

/** Text of a figure, with the unit suffix where the unit needs one. Used by the figure and by prose. */
export function useFigureText() {
  const locale = useLocale();
  const t = useTranslations("sheet.figure");
  return (f: Figure, v: number | null | undefined = f.value) => {
    if (v == null) return t("insufficient");
    const base = formatValue(v, f.unit, locale);
    if (f.unit === "ratio_per_year") return `${base}${t("perYear")}`;
    if (f.unit === "EUR_per_capita") return `${base}${t("perCapita")}`;
    return base;
  };
}

export function FlagLetters({ flags }: { flags?: string[] }) {
  const t = useTranslations("sheet.flag");
  const known = [...new Set((flags ?? []).map((f) => f.toLowerCase()))].filter((f): f is (typeof FLAGS)[number] => (FLAGS as readonly string[]).includes(f));
  if (!known.length) return null;
  return (
    <span className="inline-flex gap-0.5">
      {known.map((key) => (
        <abbr key={key} title={t(key)} className="rounded border border-border px-1 text-[10px] leading-4 font-semibold no-underline">
          {key}
          <span className="sr-only"> ({t(key)})</span>
        </abbr>
      ))}
    </span>
  );
}

/**
 * Every number on the sheet goes through here (product rules 1, 2 and 4).
 * Value + grade badge + flags; a click opens grade, period, method version and the evidence.
 * A figure without a value or without a grade is the hatched insufficient state, never 0.
 */
export function FigureValue({
  figure,
  size = "md",
  className,
}: {
  figure: Figure;
  size?: "md" | "lg";
  className?: string;
}) {
  const t = useTranslations("sheet.figure");
  const tg = useTranslations("grade");
  const tu = useTranslations("sheet.units");
  const text = useFigureText();
  const sheet = useSheet();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const onClick = (e: MouseEvent) => {
      if (e.target === d) d.close(); // backdrop click
    };
    d.addEventListener("click", onClick);
    return () => d.removeEventListener("click", onClick);
  }, []);

  if (figure.value == null || figure.grade == null) {
    return (
      <span
        className={cn("hatched inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm", className)}
        title={t("insufficientHint")}
      >
        {t("insufficient")}
      </span>
    );
  }

  const shown = text(figure);
  const ids = figure.observationIds ?? [];
  const unitLabel = (u: string) => (tu.has(u as never) ? tu(u as never) : u);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-label={t("open", { value: shown })}
        className={cn("inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-left hover:bg-surface-2", className)}
      >
        <span className={cn("num font-light", size === "lg" ? "text-4xl" : "text-xl")}>{shown}</span>
        <GradeBadge grade={figure.grade} />
        <FlagLetters flags={figure.flags} />
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto mb-0 w-full max-w-lg rounded-t-[var(--radius-tray)] border border-border bg-surface p-5 text-text backdrop:bg-black/60 sm:mb-auto sm:rounded-[var(--radius-card)]"
      >
        <div className="flex items-start justify-between gap-3">
          <p id={titleId} className="num flex items-center gap-2 text-3xl font-light">
            {shown}
            <GradeBadge grade={figure.grade} />
          </p>
          <button type="button" onClick={() => dialog.current?.close()} aria-label={t("close")} className="grid size-11 place-items-center rounded-full hover:bg-surface-2">
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted">{t("grade")}</dt>
          <dd>
            {figure.grade}: {tg(figure.grade)}
          </dd>
          <dt className="text-muted">{t("period")}</dt>
          <dd className="num">{figure.period || "-"}</dd>
          <dt className="text-muted">{t("method")}</dt>
          <dd className="num">{figure.methodVersion}</dd>
          <dt className="text-muted">{t("observations")}</dt>
          <dd className="num">{ids.length}</dd>
          <dt className="text-muted">{t("unit")}</dt>
          <dd>{unitLabel(figure.unit)}</dd>
          {figure.low != null && figure.high != null && (
            <>
              <dt className="text-muted">{t("range")}</dt>
              <dd className="num">
                {text(figure, figure.low)} – {text(figure, figure.high)}
              </dd>
            </>
          )}
          {!!figure.flags?.length && (
            <>
              <dt className="text-muted">{t("flags")}</dt>
              <dd>
                <FlagLetters flags={figure.flags} />
              </dd>
            </>
          )}
          {figure.note && (
            <>
              <dt className="text-muted">{t("note")}</dt>
              <dd>{figure.note}</dd>
            </>
          )}
        </dl>
        <div className="mt-5">
          {ids.length > 0 && sheet ? (
            <button
              type="button"
              onClick={() => {
                dialog.current?.close();
                sheet.showSources(ids);
              }}
              className="h-11 rounded-full bg-brand px-6 font-medium text-brand-contrast"
            >
              {t("viewSources")}
            </button>
          ) : figure.evidence ? (
            <button
              type="button"
              onClick={() => {
                dialog.current?.close();
                const el = document.getElementById(figure.evidence!);
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
                el?.focus({ preventScroll: true });
              }}
              className="h-11 rounded-full bg-brand px-6 font-medium text-brand-contrast"
            >
              {t("viewProvenance")}
            </button>
          ) : (
            <p className="text-sm text-muted">{t("noObservations")}</p>
          )}
        </div>
      </dialog>
    </>
  );
}
