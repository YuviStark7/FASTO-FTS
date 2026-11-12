"use client";
import { useLocale, useTranslations } from "next-intl";
import type { CellSheet } from "@/lib/queries/cell";
import { DemoBadge } from "@/components/cell/grade-badge";
import { FeedbackControl } from "@/components/feedback/feedback-control";
import { FigureValue } from "./figure-value";
import { formatDate } from "./format";
import { CSI_EVIDENCE } from "@/lib/queries/evidence";
import { InsufficientState, Panel } from "./ui";

type Consumers = NonNullable<CellSheet["consumers"]>;

function Dial({ value, label }: { value: number; label: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, Math.max(0, value / 100));
  return (
    <svg role="img" aria-label={label} viewBox="0 0 120 120" className="size-32 shrink-0">
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="6" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke="var(--brand)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${c * frac} ${c}`}
        transform="rotate(-90 60 60)"
      />
      <text x="60" y="68" textAnchor="middle" className="num fill-current text-3xl font-light">
        {Math.round(value)}
      </text>
    </svg>
  );
}

function Items({ title, items, locale }: { title: string; items: Consumers["levers"]; locale: string }) {
  const t = useTranslations("sheet.consumers");
  return (
    <Panel title={title}>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{t("noItems")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((it, i) => (
            <li key={i} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-medium">{locale === "en" ? it.label_en : it.label_it}</span>
                <FigureValue figure={it.share} />
                <span className="num text-sm text-muted">{t("mentions", { count: it.mentionCount })}</span>
              </div>
              {it.examples.length > 0 && (
                <ul className="mt-1.5 space-y-1.5">
                  {it.examples.map((e, j) => (
                    <li key={j} className="border-l-2 border-border-strong pl-3 text-sm leading-relaxed text-muted">
                      “{e}”
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Provenance({ provenance }: { provenance: Consumers["provenance"] }) {
  const t = useTranslations("sheet.consumers");
  const locale = useLocale();
  return (
    <section id={CSI_EVIDENCE} tabIndex={-1} className="scroll-mt-40 rounded-[var(--radius-card)]">
      <Panel title={t("provenance")}>
        <p className="mb-3 max-w-[75ch] text-sm leading-relaxed text-muted">{t("provenanceNote")}</p>
        {provenance.sources.length === 0 ? (
          <p className="text-sm">{t("provenanceNone")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {provenance.sources.map((s) => (
              <li key={s.slug} className="flex flex-wrap items-baseline gap-x-3">
                <a href={s.url} target="_blank" rel="noreferrer" className="link">
                  {s.name}
                </a>
                <span className="num text-muted">{t("mentions", { count: s.mentions })}</span>
                {s.licence && <span className="text-muted">{s.licence}</span>}
                <span className="num text-muted">
                  {s.lastRun ? t("lastRun", { id: s.lastRun.id, date: s.lastRun.finishedAt ? formatDate(s.lastRun.finishedAt, locale) : "-" }) : t("noRun")}
                </span>
              </li>
            ))}
          </ul>
        )}
        {provenance.scoring && (
          <p className="mt-4 border-t border-border pt-3 font-mono text-[11px] text-muted">{t("scoredWith", { model: provenance.scoring.model, prompt: provenance.scoring.promptVersion })}</p>
        )}
      </Panel>
    </section>
  );
}

export function ConsumersTab({ consumers, attention }: { consumers: CellSheet["consumers"]; attention: CellSheet["attention"] }) {
  const t = useTranslations("sheet.consumers");
  const locale = useLocale();
  const ready = consumers && consumers.published && consumers.csi.value != null;

  return (
    <div className="space-y-4">
      {ready ? (
        <>
          <Panel title={t("csi")}>
            <div className="flex flex-wrap items-center gap-6">
              <Dial value={consumers.csi.value!} label={t("dialLabel", { value: Math.round(consumers.csi.value!) })} />
              <FigureValue figure={consumers.csi} size="lg" />
              {consumers.isDemo && <DemoBadge />}
            </div>
            <ul className="mt-5 grid gap-x-8 border-t border-border pt-2 sm:grid-cols-2">
              {consumers.components.map((c) => (
                <li key={c.key} className="flex items-center justify-between gap-3 border-b border-border py-1 text-sm">
                  <span>{t(`componentNames.${c.key}`)}</span>
                  <FigureValue figure={c.figure} />
                </li>
              ))}
            </ul>
            <dl className="mt-5 grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-1.5 text-sm">
              <dt className="text-muted">n</dt>
              <dd>
                <FigureValue figure={consumers.nMentions} />
              </dd>
              <dt className="text-muted">{t("period")}</dt>
              <dd className="num">
                {formatDate(consumers.period.start, locale)} – {formatDate(consumers.period.end, locale)}
              </dd>
              <dt className="text-muted">{t("languages")}</dt>
              <dd>{consumers.languages.join(", ")}</dd>
              <dt className="text-muted">{t("representativeness")}</dt>
              <dd>{consumers.representativenessNote}</dd>
            </dl>
            <p className="note mt-4 text-muted">{t("neverSample")}</p>
            {consumers.csiSnapshotId != null && <FeedbackControl targetType="csi_snapshot" targetId={consumers.csiSnapshotId} />}
          </Panel>
          <Items title={t("levers")} items={consumers.levers} locale={locale} />
          <Items title={t("barriers")} items={consumers.barriers} locale={locale} />
        </>
      ) : (
        <InsufficientState title={t("insufficientTitle")}>
          <p>{t("insufficient")}</p>
          <p>{t("neverSample")}</p>
          {consumers && (
            <p className="flex flex-wrap items-center gap-2">
              {t("mentionsLabel")} <FigureValue figure={consumers.nMentions} />
            </p>
          )}
        </InsufficientState>
      )}

      {consumers && <Provenance provenance={consumers.provenance} />}

      <Panel title={t("attention")}>
        <p className="mb-3 max-w-[75ch] text-sm leading-relaxed text-muted">{t("attentionNote")}</p>
        {attention.length === 0 ? (
          <p className="text-sm">{t("attentionNone")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {attention.map((a) => (
              <li key={a.indicator} className="flex flex-wrap items-center justify-between gap-3 py-1 sm:justify-start sm:gap-6">
                <span className="text-sm sm:min-w-56">{t(`attentionNames.${a.indicator}`)}</span>
                <FigureValue figure={a.figure} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
