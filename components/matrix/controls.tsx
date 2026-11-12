"use client";
import { useTranslations } from "next-intl";
import type { CellStatus } from "@/components/cell/status";
import { STATUS_ORDER, type ColourMode } from "./cell-style";

export type Filters = { mode: ColourMode; country: string; status: "" | CellStatus; sort: "category" | "coverage" };

const SELECT = "field sm:w-auto sm:min-w-44";
const LABEL = "t-label mb-1.5 block";

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
    <section aria-label={t("filters")} className="grid grid-cols-2 gap-x-3 gap-y-4 sm:flex sm:flex-wrap sm:items-end sm:gap-x-4">
      <div role="group" aria-label={t("colourBy")} className="col-span-2 sm:col-span-1">
        <span className={LABEL}>{t("colourBy")}</span>
        <div className="seg">
          {(["status", "mos", "coverage"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={filters.mode === m}
              onClick={() => set({ mode: m })}
              className="seg-item"
            >
              {t(m === "status" ? "modeStatus" : m === "mos" ? "modeMos" : "modeCoverage")}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className={LABEL}>{t("country")}</span>
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
        <span className={LABEL}>{t("statusFilter")}</span>
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
        <span className={LABEL}>{t("sortBy")}</span>
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
          className="btn col-span-2 animate-[fade-in_var(--dur-base)_ease-out] px-4 text-brand-alt hover:bg-surface-2 sm:col-span-1"
        >
          {t("reset")}
        </button>
      )}
    </section>
  );
}
