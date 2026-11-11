"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import type { CellSheet } from "@/lib/queries/cell";
import { CategoryIcon } from "@/components/cell/category-icon";
import { DemoBadge, GradeBadge, type Grade } from "@/components/cell/grade-badge";
import { StatusLabel } from "@/components/cell/status";
import { cn } from "@/lib/utils";
import { CompetitionTab } from "./competition-tab";
import { ConsumersTab } from "./consumers-tab";
import { formatDate } from "./format";
import { MarketTab } from "./market-tab";
import { OpportunityTab } from "./opportunity-tab";
import { SheetContext } from "./sheet-context";
import { SourcesTab } from "./sources-tab";
import { TerritoryTab } from "./territory-tab";

const TABS = ["market", "territory", "consumers", "competition", "opportunity", "sources"] as const;
type Tab = (typeof TABS)[number];

export function SheetView({ sheet }: { sheet: CellSheet }) {
  const t = useTranslations("sheet");
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>("market");
  const [filter, setFilter] = useState<number[] | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const touch = useRef<{ x: number; y: number } | null>(null);

  const go = useCallback((next: Tab, focus = false) => {
    setTab(next);
    if (focus) tabRefs.current[next]?.focus();
  }, []);
  const ctx = useMemo(() => ({ showSources: (ids: number[]) => { setFilter(ids); setTab("sources"); } }), []);

  useEffect(() => {
    tabRefs.current[tab]?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }, [tab]);

  const onKey = (e: React.KeyboardEvent) => {
    const i = TABS.indexOf(tab);
    const n =
      e.key === "ArrowRight" ? TABS[(i + 1) % TABS.length]
      : e.key === "ArrowLeft" ? TABS[(i + TABS.length - 1) % TABS.length]
      : e.key === "Home" ? TABS[0]
      : e.key === "End" ? TABS[TABS.length - 1]
      : null;
    if (n) {
      e.preventDefault();
      go(n, true);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    touch.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
    const i = TABS.indexOf(tab) + (dx < 0 ? 1 : -1);
    if (i >= 0 && i < TABS.length) go(TABS[i]);
  };

  return (
    <SheetContext.Provider value={ctx}>
      <div className="lg:grid lg:min-h-dvh lg:grid-cols-[380px_1fr]">
        {renderVerdict(sheet)}
        <div className="min-w-0">
          <div className="sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur">
            <div
              role="tablist"
              aria-label={t("tabsLabel")}
              onKeyDown={onKey}
              className="no-scrollbar flex gap-1 overflow-x-auto px-3 lg:px-6"
            >
              {TABS.map((k) => (
                <button
                  key={k}
                  ref={(el) => {
                    tabRefs.current[k] = el;
                  }}
                  role="tab"
                  id={`tab-${k}`}
                  type="button"
                  aria-selected={tab === k}
                  aria-controls={`panel-${k}`}
                  tabIndex={tab === k ? 0 : -1}
                  onClick={() => go(k)}
                  className={cn(
                    "min-h-11 shrink-0 border-b-2 px-4 text-sm font-medium whitespace-nowrap",
                    tab === k ? "border-brand text-text" : "border-transparent text-muted hover:text-text",
                  )}
                >
                  {t(`tabs.${k}`)}
                </button>
              ))}
            </div>
          </div>
          <div
            role="tabpanel"
            id={`panel-${tab}`}
            aria-labelledby={`tab-${tab}`}
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            style={{ touchAction: "pan-y" }}
            className="min-h-[60dvh] px-4 py-5 lg:px-6"
          >
            <div key={tab} className="animate-[fade_0.25s_ease-out]">
              {tab === "market" && <MarketTab market={sheet.market} />}
              {tab === "territory" && <TerritoryTab data={sheet.territoryTab} />}
              {tab === "consumers" && <ConsumersTab consumers={sheet.consumers} attention={sheet.attention} />}
              {tab === "competition" && <CompetitionTab competition={sheet.competition} />}
              {tab === "opportunity" && <OpportunityTab />}
              {tab === "sources" && <SourcesTab ledger={sheet.ledger} filter={filter} onClear={() => setFilter(null)} />}
            </div>
          </div>
        </div>
      </div>
    </SheetContext.Provider>
  );

  function renderVerdict(sheet: CellSheet) {
    const { category, territory, cell, market } = sheet;
    const name = (x: { name_it: string; name_en: string }) => (locale === "en" ? x.name_en : x.name_it);
    const unknown = cell.status === "insufficient_data";
    const mix = (Object.entries(cell.gradeMix) as [Grade, number][]).filter(([, v]) => v > 0);
    const total = mix.reduce((a, [, v]) => a + v, 0);
    const period = market?.window.first && market.window.last ? `${market.window.first}–${market.window.last}` : null;
    const country = name(territory.country);
    return (
      <header className="space-y-4 px-4 pt-5 pb-4 lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:border-r lg:border-border lg:px-6 lg:pt-8">
        <Link href="/matrix" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-text">
          <ArrowLeft aria-hidden className="size-4" />
          {t("back")}
        </Link>
        <div className="flex items-center gap-3">
          <div
            aria-hidden
            className="flex h-24 w-20 shrink-0 items-center justify-center rounded-[var(--radius-card)] text-bg shadow-lg"
            style={{ backgroundColor: category.color }}
          >
            <CategoryIcon name={category.icon} className="size-7" />
          </div>
          <div
            aria-hidden
            className={cn(
              "flex h-24 w-20 shrink-0 flex-col items-center justify-center rounded-[var(--radius-card)] border border-border px-1 text-center text-xs font-medium shadow-lg",
              unknown ? "hatched" : "bg-surface-2",
            )}
          >
            <span className="line-clamp-2">{name(territory)}</span>
            <span className="text-[10px] text-muted">{territory.country_code}</span>
          </div>
        </div>
        <h1 className="text-2xl leading-tight font-light">{t("verdict.pair", { category: name(category), territory: name(territory) })}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusLabel status={cell.status} className="text-base" />
          {cell.isDemo && <DemoBadge />}
        </div>
        <p className="text-sm text-muted">
          {period ? t("verdict.scope", { country, period }) : t("verdict.scopeNoPeriod", { country })}
        </p>
        {unknown && <p className="text-sm">{t("verdict.insufficient")}</p>}
        {cell.missingInputs.length > 0 && <p className="text-sm text-muted">{t("verdict.missing", { inputs: cell.missingInputs.join(", ") })}</p>}
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>{t("verdict.coverage")}</span>
            <span className="num">{Math.round(cell.coveragePct)}%</span>
          </div>
          <div role="progressbar" aria-label={t("verdict.coverage")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(cell.coveragePct)} className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, Math.max(0, cell.coveragePct))}%` }} />
          </div>
        </div>
        {total > 0 && (
          <div>
            <div className="mb-1 text-xs text-muted">{t("verdict.gradeMix")}</div>
            <ul className="num flex flex-wrap gap-3 text-sm">
              {mix.map(([g, v]) => (
                <li key={g} className="flex items-center gap-1.5">
                  <GradeBadge grade={g} />
                  {Math.round((v / total) * 100)}%
                </li>
              ))}
            </ul>
          </div>
        )}
        {territory.scopeNote && (
          <p className="rounded-lg border border-border p-3 text-sm">
            <span className="text-muted">{t("verdict.territoryNote")}: </span>
            {territory.scopeNote}
          </p>
        )}
        {category.scopeNote && (
          <p className="rounded-lg border border-border p-3 text-sm">
            <span className="text-muted">{t("verdict.categoryNote")}: </span>
            {category.scopeNote}
          </p>
        )}
        <p className="text-xs text-muted">{t("verdict.updated", { date: formatDate(cell.updatedAt, locale) })}</p>
      </header>
    );
  }
}
