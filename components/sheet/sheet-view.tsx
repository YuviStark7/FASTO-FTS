"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  // Deep link from the Opportunities ranking: ?tab=opportunity opens that tab.
  const tabParam = useSearchParams().get("tab");
  const [tab, setTab] = useState<Tab>(() => (TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "market"));
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
      <div className="lg:grid lg:grid-cols-[380px_1fr]">
        {renderVerdict(sheet)}
        <div className="min-w-0">
          {/* Sticks under the fixed header, never behind the chip. */}
          <div className="sticky top-[var(--header-h)] z-20 border-b border-border bg-bg/85 backdrop-blur-md">
            <div
              role="tablist"
              aria-label={t("tabsLabel")}
              onKeyDown={onKey}
              className="no-scrollbar flex gap-1 overflow-x-auto px-2 [mask-image:linear-gradient(to_right,black_85%,transparent)] lg:px-6 lg:[mask-image:none]"
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
                    // The underline grows from the centre of the selected tab.
                    "relative min-h-12 shrink-0 px-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-(--dur-base) -outline-offset-4 after:absolute after:inset-x-3.5 after:bottom-0 after:h-0.5 after:origin-center after:rounded-full after:bg-brand after:transition-transform after:duration-(--dur-slow) after:ease-out",
                    tab === k ? "text-text after:scale-x-100" : "text-muted after:scale-x-0 hover:text-text",
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
            className="min-h-[60dvh] px-4 pt-5 pb-16 -outline-offset-2 lg:px-8 lg:pt-6"
          >
            <div key={tab} className="mx-auto max-w-5xl animate-[fade_var(--dur-slow)_var(--ease-out)]">
              {tab === "market" && <MarketTab market={sheet.market} />}
              {tab === "territory" && <TerritoryTab data={sheet.territoryTab} />}
              {tab === "consumers" && <ConsumersTab consumers={sheet.consumers} attention={sheet.attention} />}
              {tab === "competition" && <CompetitionTab competition={sheet.competition} />}
              {tab === "opportunity" && <OpportunityTab opportunity={sheet.opportunity} />}
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
      <header className="space-y-5 px-4 pt-2 pb-6 lg:sticky lg:top-[var(--header-h)] lg:h-[calc(100dvh-var(--header-h))] lg:overflow-y-auto lg:border-r lg:border-border lg:px-8 lg:pt-4 lg:pb-10">
        <Link href="/matrix" className="group -ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-full px-1 text-sm text-muted transition-colors duration-(--dur-base) hover:text-text">
          <ArrowLeft aria-hidden className="size-4 transition-transform duration-(--dur-base) group-hover:-translate-x-0.5" />
          {t("back")}
        </Link>
        <div className="flex items-center gap-3">
          <div
            aria-hidden
            className="flex h-24 w-20 shrink-0 items-center justify-center rounded-[var(--radius-card)] text-on-category shadow-e2 ring-1 ring-white/20 ring-inset"
            style={{ backgroundColor: category.color }}
          >
            <CategoryIcon name={category.icon} className="size-7" />
          </div>
          <div
            aria-hidden
            className={cn(
              "flex h-24 w-20 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-card)] border px-1.5 text-center text-xs font-medium shadow-e2",
              unknown ? "hatched border-border-strong/60" : "border-border bg-surface-2",
            )}
          >
            <span className="line-clamp-2">{name(territory)}</span>
            <span className={cn("text-[10px] font-medium tracking-[0.14em]", unknown ? "text-text" : "text-muted")}>{territory.country_code}</span>
          </div>
        </div>
        <h1 className="text-[1.75rem] leading-[1.1] font-light tracking-[-0.025em] lg:text-[2rem]">{t("verdict.pair", { category: name(category), territory: name(territory) })}</h1>
        <div className="-mt-1 flex flex-wrap items-center gap-2.5">
          <StatusLabel status={cell.status} className="text-lg [&>svg]:size-5" />
          {cell.isDemo && <DemoBadge />}
        </div>
        <p className="t-meta">
          {period ? t("verdict.scope", { country, period }) : t("verdict.scopeNoPeriod", { country })}
        </p>
        {unknown && <p className="text-sm">{t("verdict.insufficient")}</p>}
        {cell.missingInputs.length > 0 && <p className="t-meta -mt-3">{t("verdict.missing", {
              inputs: cell.missingInputs.map((k) => (t.has(`verdict.inputNames.${k}` as never) ? t(`verdict.inputNames.${k}` as never) : k)).join(", "),
            })}</p>}
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="t-label">{t("verdict.coverage")}</span>
            <span className="num text-sm">{Math.round(cell.coveragePct)}%</span>
          </div>
          <div role="progressbar" aria-label={t("verdict.coverage")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(cell.coveragePct)} className="h-1 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full origin-left animate-[grow_700ms_var(--ease-out)] rounded-full bg-brand" style={{ width: `${Math.min(100, Math.max(0, cell.coveragePct))}%` }} />
          </div>
        </div>
        {total > 0 && (
          <div>
            <div className="t-label mb-2">{t("verdict.gradeMix")}</div>
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
          <p className="note">
            <span className="text-muted">{t("verdict.territoryNote")}: </span>
            {territory.scopeNote}
          </p>
        )}
        {category.scopeNote && (
          <p className="note">
            <span className="text-muted">{t("verdict.categoryNote")}: </span>
            {category.scopeNote}
          </p>
        )}
        <p className="text-xs text-muted">{t("verdict.updated", { date: formatDate(cell.updatedAt, locale) })}</p>
      </header>
    );
  }
}
