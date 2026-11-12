"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { CircleDashed } from "lucide-react";
import type { Marker } from "maplibre-gl";
import { TokenCarousel } from "@/components/cell/scout-view";
import { statusIcon, type CellStatus } from "@/components/cell/status";
import { MatrixLegend } from "@/components/matrix/legend";
import { STATUS_CLASS } from "@/components/matrix/cell-style";
import { cellKey, localName } from "@/components/matrix/model";
import { radiusFor } from "@/lib/map-geo";
import type { Category, CellRow, GeoEstimate, MapTerritory } from "@/lib/queries/map";
import { cn } from "@/lib/utils";
import { GradeBadge } from "@/components/cell/grade-badge";
import { formatValue } from "@/components/sheet/format";
import { CitySheet, type CityDetail } from "./city-sheet";

type Props = { categories: Category[]; territories: MapTerritory[]; cells: CellRow[]; estimates: GeoEstimate[] };
type Mode = "loading" | "map" | "fallback";

const STYLE_BASE = "https://tiles.openfreemap.org/styles";
const STYLE_TIMEOUT_MS = 10_000;

type City = {
  territory: MapTerritory;
  name: string;
  status: CellStatus;
  isDemo: boolean;
  estimate: GeoEstimate | null;
  radius: number;
};

/**
 * Map: one category at a time, the 20 pilot cities as circles. Size = local demand (grade B estimate),
 * status = token colour + icon + word, no estimate = small dashed hatched circle.
 * The list of cities mirrors the map: screen-reader/keyboard access normally, and the visible fallback when WebGL or tiles fail.
 */
export function MapView({ categories, territories, cells, estimates }: Props) {
  const t = useTranslations("map");
  const ts = useTranslations("status");
  const locale = useLocale();

  const [catSlug, setCatSlug] = useState(categories[0]?.slug ?? "");
  const [selected, setSelected] = useState<string | null>(null);
  const [hot, setHot] = useState<string | null>(null); // hovered or focused city: its label shows
  const [mode, setMode] = useState<Mode>("loading");
  const [hosts, setHosts] = useState<Map<string, HTMLElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const attributionRef = useRef(t("attribution"));
  const category = categories.find((c) => c.slug === catSlug);

  const cities = useMemo<City[]>(() => {
    if (!category) return [];
    const est = new Map(estimates.map((e) => [cellKey(e.category_id, e.territory_id), e]));
    const cellBy = new Map(cells.map((c) => [cellKey(c.category_id, c.territory_id), c]));
    const rows = territories.map((territory) => {
      const k = cellKey(category.id, territory.id);
      const cell = cellBy.get(k);
      return { territory, cell, estimate: est.get(k) ?? null };
    });
    const max = Math.max(0, ...rows.map((r) => r.estimate?.value ?? 0));
    return rows.map(({ territory, cell, estimate }) => ({
      territory,
      name: localName(territory, locale),
      status: cell?.status ?? "insufficient_data",
      isDemo: !!cell?.is_demo,
      estimate,
      radius: radiusFor(estimate?.value ?? null, max),
    }));
  }, [category, territories, cells, estimates, locale]);

  const demandText = useCallback(
    (c: City) =>
      // An estimate (grade B) is shown rounded: euro-level digits would claim a precision it does not have.
      c.estimate ? `${formatValue(c.estimate.value, c.estimate.unit, locale)} (${c.estimate.grade})` : t("noEstimate"),
    [locale, t],
  );

  // Create the map once. Anything that goes wrong before the style is ready switches to the list.
  const located = useMemo(() => territories.filter((x) => x.lonLat), [territories]);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || located.length === 0) {
      setMode("fallback");
      return;
    }
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      try {
        const maplibre = (await import("maplibre-gl")).default;
        if (disposed) return;
        const dark = document.documentElement.dataset.theme !== "light";
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const map = new maplibre.Map({
          container: el,
          style: `${STYLE_BASE}/${dark ? "dark" : "positron"}`,
          attributionControl: { compact: false, customAttribution: attributionRef.current },
          cooperativeGestures: true,
          fadeDuration: reduce ? 0 : 300,
        });
        const bounds = new maplibre.LngLatBounds();
        located.forEach((x) => bounds.extend(x.lonLat!));
        map.fitBounds(bounds, { padding: 56, maxZoom: 6, animate: false });

        const made = new Map<string, HTMLElement>();
        const markers: Marker[] = [];
        for (const x of located) {
          const host = document.createElement("div");
          const m = new maplibre.Marker({ element: host }).setLngLat(x.lonLat!).addTo(map);
          made.set(x.slug, host);
          markers.push(m);
        }

        cleanup = () => {
          clearTimeout(timer);
          markers.forEach((m) => m.remove());
          map.remove();
        };
        const fail = () => {
          if (disposed) return;
          cleanup();
          cleanup = () => {};
          setHosts(new Map());
          setMode("fallback");
        };
        const timer = setTimeout(fail, STYLE_TIMEOUT_MS);
        map.once("error", fail); // style or tiles could not be fetched before it was ready
        map.once("load", () => {
          if (disposed) return;
          clearTimeout(timer);
          map.off("error", fail);
          setHosts(made);
          setMode("map");
        });
      } catch {
        if (!disposed) setMode("fallback"); // no WebGL
      }
    })();
    return () => {
      disposed = true;
      cleanup();
    };
  }, [located]);

  const detail: CityDetail | null = useMemo(() => {
    const c = cities.find((x) => x.territory.slug === selected);
    if (!c || !category) return null;
    return {
      city: c.name,
      category: localName(category, locale),
      categorySlug: category.slug,
      territorySlug: c.territory.slug,
      status: c.status,
      isDemo: c.isDemo,
      estimate: c.estimate,
    };
  }, [cities, selected, category, locale]);

  const close = useCallback(() => setSelected(null), []);

  if (territories.length === 0 || !category) {
    return (
      <div className="page max-w-3xl space-y-5">
        <h1 className="t-h1">{t("title")}</h1>
        <p role="status" className="card p-6 text-muted">
          {t("empty")}
        </p>
      </div>
    );
  }

  const noCoords = territories.length - located.length;
  const fallback = mode === "fallback";

  return (
    <div className="page max-w-[1800px] space-y-5">
      <header className="page-header">
        <h1 className="t-h1">{t("title")}</h1>
        <p className="t-lead">{t("lead")}</p>
      </header>

      <div className="-mx-4 lg:mx-0">
        <TokenCarousel
          label={t("pickCategory")}
          items={categories.map((c) => ({ id: c.slug, label: localName(c, locale), color: c.color, icon: c.icon }))}
          value={catSlug}
          onChange={(s) => {
            setCatSlug(s);
            setSelected(null);
          }}
        />
      </div>

      {fallback && (
        <p role="status" className="note">
          {t("tilesFailed")}
        </p>
      )}
      {noCoords > 0 && (
        <p role="status" className="t-meta">
          {t("noCoordinates", { count: noCoords })}
        </p>
      )}

      <MatrixLegend mode="status" mosMissing={false} />
      <ul className="-mt-2 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted">
        <li>{t("legendSize")}</li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="hatched grid size-5 place-items-center rounded-full border border-dashed border-border-strong text-text">
            <CircleDashed className="size-3" />
          </span>
          {t("legendNoEstimate")}
        </li>
      </ul>

      {!fallback && (
        <div
          role="region"
          aria-label={t("canvasLabel")}
          className="card relative h-[58dvh] min-h-80 overflow-hidden lg:h-[calc(100dvh-19rem)]"
        >
          <div ref={containerRef} className="absolute inset-0" />
          {mode === "loading" && (
            <p role="status" className="skeleton absolute inset-0 grid place-items-center rounded-none text-muted">
              …
            </p>
          )}
        </div>
      )}

      {mode === "map" &&
        cities.map((c) => {
          const host = hosts.get(c.territory.slug);
          return host ? createPortal(<CircleMarker city={c} active={hot === c.territory.slug || selected === c.territory.slug} onPick={setSelected} onHot={setHot} demand={demandText(c)} />, host, c.territory.slug) : null;
        })}

      <section aria-label={t("listLabel")} className={cn(!fallback && "sr-only")}>
        {fallback && <h2 className="t-label mb-3">{t("listTitle")}</h2>}
        <ul data-testid="map-city-list" className={cn(fallback && "grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4")}>
          {cities.map((c) => {
            const Icon = statusIcon(c.status);
            const on = selected === c.territory.slug;
            return (
              <li key={c.territory.slug}>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={on}
                  aria-label={t("cityItem", { city: c.name, status: ts(c.status), demand: demandText(c) })}
                  onClick={() => setSelected(c.territory.slug)}
                  onFocus={() => setHot(c.territory.slug)}
                  onBlur={() => setHot(null)}
                  className={cn(
                    fallback &&
                      "card card-link flex min-h-16 w-full items-center gap-3 px-3.5 py-2 text-left",
                    fallback && on && "border-text",
                  )}
                >
                  {fallback && (
                    <>
                      <span
                        aria-hidden
                        className={cn("grid size-10 shrink-0 place-items-center rounded-full border", STATUS_CLASS[c.status], c.estimate === null && "border-dashed")}
                      >
                        <Icon className="size-5" />
                      </span>
                      <span className="flex-1" aria-hidden>
                        <span className="block font-medium">{c.name}</span>
                        <span className="num mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                          {ts(c.status)} ·{" "}
                          {c.estimate ? (
                            <>
                              {formatValue(c.estimate.value, c.estimate.unit, locale)}
                              <GradeBadge grade={c.estimate.grade} />
                            </>
                          ) : (
                            t("noEstimate")
                          )}
                        </span>
                      </span>
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {detail && <CitySheet detail={detail} onClose={close} />}
    </div>
  );
}

function CircleMarker({
  city,
  active,
  demand,
  onPick,
  onHot,
}: {
  city: City;
  active: boolean;
  demand: string;
  onPick: (slug: string) => void;
  onHot: (slug: string | null) => void;
}) {
  const ts = useTranslations("status");
  const Icon = statusIcon(city.status);
  const d = Math.max(28, city.radius * 2);
  const slug = city.territory.slug;
  const noEstimate = city.estimate === null;
  return (
    <div className="group relative grid place-items-center" style={{ width: d, height: d }}>
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={() => onPick(slug)}
        onMouseEnter={() => onHot(slug)}
        onMouseLeave={() => onHot(null)}
        title={`${city.name}: ${ts(city.status)}, ${demand}`}
        className="grid place-items-center rounded-full bg-surface shadow-e2 transition-[scale] duration-(--dur-base) ease-spring hover:scale-110"
        style={{ width: city.radius * 2, height: city.radius * 2 }}
      >
        <span
          className={cn(
            "grid size-full place-items-center rounded-full border-2",
            STATUS_CLASS[city.status],
            noEstimate && "hatched border-dashed",
          )}
        >
          {!noEstimate || city.radius > 12 ? <Icon aria-hidden className="size-4" /> : null}
        </span>
      </button>
      <span
        aria-hidden
        className={cn(
          "num pointer-events-none absolute top-full z-10 mt-1.5 rounded-[var(--radius-chip)] border border-border bg-surface px-2 py-1 text-xs whitespace-nowrap text-text shadow-e2",
          active ? "block animate-[pop_var(--dur-fast)_var(--ease-out)]" : "hidden",
        )}
      >
        {city.name}: {ts(city.status)}, {demand}
      </span>
    </div>
  );
}
