"use client";
import { useTranslations } from "next-intl";
import type { CellStatus } from "@/components/cell/status";
import { cn } from "@/lib/utils";
import { STATUS_ORDER, type ColourMode } from "./cell-style";

export type Filters = { mode: ColourMode; country: string; status: "" | CellStatus; sort: "category" | "coverage" };

const SELECT = "h-11 w-full rounded-xl border border-border bg-surface px-3 text-text sm:w-auto sm:min-w-40";

export function MatrixControls({
  filters,
  onChange,
  onReset,
  countries,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  onReset: () => void;
  countries: string[];
}) {
  const t = useTranslations("matrix");
  const s = useTranslations("status");
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const dirty = filters.country !== "" || filters.status !== "" || filters.sort !== "category";

  return (
    <section aria-label={t("filters")} className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
      <div role="group" aria-label={t("colourBy")} className="col-span-2 sm:col-span-1">
        <span className="mb-1 block text-xs text-muted">{t("colourBy")}</span>
        <div className="inline-flex rounded-full border border-border bg-surface p-1">
          {(["status", "mos", "coverage"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={filters.mode === m}
              onClick={() => set({ mode: m })}
              className={cn(
                "h-9 min-w-20 rounded-full px-4 text-sm font-medium",
                filters.mode === m ? "bg-brand text-brand-contrast" : "text-muted",
              )}
            >
              {t(m === "status" ? "modeStatus" : m === "mos" ? "modeMos" : "modeCoverage")}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs text-muted">{t("country")}</span>
        <select className={SELECT} value={filters.country} onChange={(e) => set({ country: e.target.value })}>
          <option value="">{t("allCountries")}</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-muted">{t("statusFilter")}</span>
        <select
          className={SELECT}
          value={filters.status}
          onChange={(e) => set({ status: e.target.value as Filters["status"] })}
        >
          <option value="">{t("allStatuses")}</option>
          {STATUS_ORDER.map((st) => (
            <option key={st} value={st}>
              {s(st)}
            </option>
          ))}
        </select>
      </label>

      <label className="col-span-2 block sm:col-span-1">
        <span className="mb-1 block text-xs text-muted">{t("sortBy")}</span>
        <select
          className={SELECT}
          value={filters.sort}
          onChange={(e) => set({ sort: e.target.value as Filters["sort"] })}
        >
          <option value="category">{t("sortCategory")}</option>
          <option value="coverage">{t("sortCoverage")}</option>
        </select>
      </label>

      {dirty && (
        <button
          type="button"
          onClick={onReset}
          className="col-span-2 h-11 rounded-full px-4 text-sm text-brand-alt underline sm:col-span-1"
        >
          {t("reset")}
        </button>
      )}
    </section>
  );
}
