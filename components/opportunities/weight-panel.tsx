"use client";
import { useId, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronUp, RotateCcw, SlidersHorizontal } from "lucide-react";
import { saveWeightSet } from "@/app/[locale]/(app)/opportunities/actions";
import type { WeightSet } from "@/lib/queries/opportunities";
import { COMPONENTS, type Weights } from "@/lib/scoring/mos";
import { cn } from "@/lib/utils";
import { SEGMENT, sameWeights, toSliders, type Sliders } from "./weights";

type Message = { kind: "ok"; name: string } | { kind: "error"; error: "name" | "weights" | "forbidden" | "failed" } | null;

/**
 * What-if weights. On phones a tray docked at the bottom (the list stays visible above it and re-ranks
 * as a slider moves); from 1024 px a panel beside the list. Only "Save" talks to the server.
 */
export function WeightPanel({
  sliders,
  weights,
  isDefault,
  defaultWeights,
  sets,
  canSave,
  onChange,
  onSaved,
}: {
  sliders: Sliders;
  /** Normalised weights, or null when every slider is at zero. */
  weights: Weights | null;
  isDefault: boolean;
  defaultWeights: Weights;
  sets: WeightSet[];
  canSave: boolean;
  onChange: (s: Sliders) => void;
  onSaved: (s: WeightSet) => void;
}) {
  const t = useTranslations("opportunities");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [pending, start] = useTransition();
  const bodyId = useId();
  const pct = useMemo(() => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }), [locale]);

  const current = isDefault ? "default" : String(sets.find((s) => weights && sameWeights(s.weights, weights))?.id ?? "");
  const apply = (value: string) => {
    const w = value === "default" ? defaultWeights : sets.find((s) => String(s.id) === value)?.weights;
    if (w) onChange(toSliders(w));
    setMessage(null);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!weights) return;
    start(async () => {
      const res = await saveWeightSet(name, weights);
      if (res.ok) {
        onSaved(res.set);
        setName("");
        setMessage({ kind: "ok", name: res.set.name });
      } else setMessage({ kind: "error", error: res.error });
    });
  };

  return (
    <aside
      aria-label={t("weights.title")}
      data-testid="weight-panel"
      className="fixed inset-x-0 bottom-0 z-30 rounded-t-[var(--radius-tray)] border border-b-0 border-border bg-surface pb-[env(safe-area-inset-bottom)] shadow-e3 lg:sticky lg:inset-x-auto lg:top-[calc(var(--header-h)+0.5rem)] lg:bottom-auto lg:z-auto lg:max-h-[calc(100dvh-var(--header-h)-1.5rem)] lg:self-start lg:overflow-y-auto lg:rounded-[var(--radius-card)] lg:border-b lg:pb-0 lg:shadow-e1"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        aria-label={open ? t("weights.close") : t("weights.open")}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-14 w-full items-center gap-3 rounded-t-[var(--radius-tray)] px-5 text-left -outline-offset-4 lg:hidden"
      >
        <SlidersHorizontal aria-hidden className="size-5 text-brand" />
        <span className="flex-1">
          <span className="font-medium">{t("weights.title")}</span>
          <span className="t-meta ml-2">{isDefault ? t("weights.stateDefault") : t("weights.stateCustom")}</span>
        </span>
        <ChevronUp aria-hidden className={cn("size-5 text-muted transition-transform duration-(--dur-slow)", open && "rotate-180")} />
      </button>

      <div id={bodyId} className={cn("max-h-[46dvh] space-y-4 overflow-y-auto px-5 pt-1 pb-5 lg:block lg:max-h-none lg:overflow-visible lg:p-5", !open && "max-lg:hidden")}>
        <h2 className="t-h2 max-lg:hidden">{t("weights.title")}</h2>
        <p className="t-meta">{t("weights.lead")}</p>

        <ul className="space-y-1 lg:space-y-2">
          {COMPONENTS.map((k) => {
            const label = t(`components.${k}`);
            return (
              <li key={k}>
                <label className="block">
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <span aria-hidden className={cn("size-2 rounded-[3px]", SEGMENT[k])} />
                      {label}
                    </span>
                    <output className="num" data-testid={`weight-${k}`}>
                      {weights ? pct.format(weights[k]) : pct.format(0)}
                    </output>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={sliders[k]}
                    aria-label={t("weights.slider", { name: label })}
                    aria-valuetext={weights ? pct.format(weights[k]) : pct.format(0)}
                    onChange={(e) => {
                      onChange({ ...sliders, [k]: Number(e.target.value) });
                      setMessage(null);
                    }}
                    className="h-11 w-full cursor-pointer accent-brand lg:h-7"
                  />
                </label>
              </li>
            );
          })}
        </ul>
        <p className="t-meta">{t("weights.fitNote")}</p>
        {!weights && (
          <p role="alert" className="note">
            {t("weights.allZero")}
          </p>
        )}

        <button type="button" onClick={() => apply("default")} disabled={isDefault} className="btn btn-ghost w-full">
          <RotateCcw aria-hidden className="size-4" />
          {t("weights.resetDefault")}
        </button>

        <label className="block border-t border-border pt-4">
          <span className="t-label mb-1.5 block">{t("weights.sets")}</span>
          <select className="field" value={current} onChange={(e) => apply(e.target.value)}>
            {current === "" && <option value="">{t("weights.setCustom")}</option>}
            <option value="default">{t("weights.setDefault")}</option>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        {canSave ? (
          <form onSubmit={save} className="space-y-2.5">
            <label className="block">
              <span className="t-label mb-1.5 block">{t("weights.saveTitle")}</span>
              <input
                className="field"
                value={name}
                maxLength={80}
                required
                placeholder={t("weights.name")}
                aria-label={t("weights.name")}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button type="submit" disabled={pending || !weights || name.trim() === ""} className="btn btn-primary w-full">
              {pending ? t("weights.saving") : t("weights.save")}
            </button>
          </form>
        ) : (
          <p className="t-meta">{t("weights.viewer")}</p>
        )}
        <p aria-live="polite" className={cn("text-sm", !message && "sr-only")}>
          {message?.kind === "ok" ? t("weights.saved", { name: message.name }) : message ? t(`weights.error.${message.error}`) : ""}
        </p>
      </div>
    </aside>
  );
}
