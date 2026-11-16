"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { GradeBadge } from "@/components/cell/grade-badge";
import { usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Guided tour of the Scout screen for new users: seven steps, each a spotlight on a real element
 * (found through `data-tour` attributes) and a card that explains it.
 *
 * Starts by itself on the Scout route once the first-load intro is over, for a user who has neither
 * finished nor skipped it (remembered per user in localStorage). `?tour=1` starts it regardless: the
 * replay link in Settings and the tests use it. Never starts by itself under automation.
 *
 * While it runs, a transparent layer takes every pointer event, so the page underneath (the
 * spotlighted element included) is not interactive and a click outside the card does nothing.
 */

/** Event the header chip listens to: the tour holds it open while it points at the Ask item. */
export const TOUR_CHIP_EVENT = "fasto:tour-chip";

const INTRO_ATTR = "data-scout-intro";
const START_DELAY_MS = 400;
/** Spotlight and card ease to the new target for this long after a step change, then follow instantly. */
const SETTLE_MS = 450;
const PAD = 6; // room between the target and the spotlight edge
const GAP = 14; // between the spotlight and the card
const MARGIN = 12; // between the card and the viewport edge
const PHONE_MAX = 640; // below the `sm` breakpoint the card is a sheet

type Step = {
  key: "pages" | "select" | "verdict" | "sheet" | "mos" | "ask" | "profile";
  /** First visible match wins. */
  targets: string[];
  /** Extra element included in the spotlight when it is visible. */
  plus?: string;
  /** Hold the header chip open during this step. */
  openChip?: boolean;
};

const STEPS: Step[] = [
  { key: "pages", targets: ['[data-tour="chip"]'] },
  // The chips while the flower is closed, the whole flower zone if it happens to be open.
  { key: "select", targets: ['[data-tour="chips"]', '[data-tour="flower"]'] },
  // The verdict together with the pills, so a grade badge (on the MOS pill) is inside the spotlight.
  { key: "verdict", targets: ['[data-tour="verdict"]'], plus: '[data-tour="pills"]' },
  { key: "sheet", targets: ['[data-tour="open-cell"]'] },
  { key: "mos", targets: ['[data-tour="mos"]'] },
  { key: "ask", targets: ['[data-tour="ask"]', '[data-tour="chip"]'], openChip: true },
  { key: "profile", targets: ['[data-tour="profile"]'] },
];

type Spot = { x: number; y: number; w: number; h: number; r: number };
type Geom = { spot: Spot | null; x: number; y: number; dock: "float" | "bottom" | "top"; vw: number; vh: number };

/** Set once the tour has ended in this page lifetime, so a failing localStorage cannot make it loop. */
let endedThisLifetime = false;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

function isShown(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement) || el.closest("[inert]")) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return false;
  if (typeof el.checkVisibility === "function") return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    const s = getComputedStyle(n);
    if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") return false;
  }
  return true;
}

const find = (selectors: string[]) => {
  for (const s of selectors) {
    const el = document.querySelector(s);
    if (el && isShown(el)) return el;
  }
  return null;
};

function measure(step: Step, vw: number, vh: number): Spot | null {
  const el = find(step.targets);
  if (!el) return null;
  let { left, top, right, bottom } = el.getBoundingClientRect();
  let radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  const extra = step.plus ? find([step.plus]) : null;
  if (extra) {
    const e = extra.getBoundingClientRect();
    left = Math.min(left, e.left);
    top = Math.min(top, e.top);
    right = Math.max(right, e.right);
    bottom = Math.max(bottom, e.bottom);
    radius = 0;
  }
  if (right <= 0 || bottom <= 0 || left >= vw || top >= vh) return null; // scrolled out of view
  const x = Math.max(0, Math.round(left - PAD));
  const y = Math.max(0, Math.round(top - PAD));
  const w = Math.min(vw, Math.round(right + PAD)) - x;
  const h = Math.min(vh, Math.round(bottom + PAD)) - y;
  return { x, y, w, h, r: Math.round(Math.min(Math.max(14, radius + PAD), Math.min(w, h) / 2)) };
}

/** Card position: beside the target, flipped to whichever side has room; a sheet on phones. */
function place(spot: Spot | null, cw: number, ch: number, vw: number, vh: number): Pick<Geom, "x" | "y" | "dock"> {
  if (vw < PHONE_MAX) {
    // Bottom sheet; it moves to the top edge only when it would cover less of the target up there.
    const coveredAtBottom = spot ? Math.max(0, spot.y + spot.h + GAP - (vh - ch)) : 0;
    const coveredAtTop = spot ? Math.max(0, ch + GAP - spot.y) : 0;
    return coveredAtTop < coveredAtBottom ? { x: 0, y: 0, dock: "top" } : { x: 0, y: vh - ch, dock: "bottom" };
  }
  if (!spot) return { x: Math.round((vw - cw) / 2), y: Math.round((vh - ch) / 2), dock: "float" };
  const cx = Math.round(clamp(spot.x + spot.w / 2 - cw / 2, MARGIN, vw - cw - MARGIN));
  const cy = Math.round(clamp(spot.y + spot.h / 2 - ch / 2, MARGIN, vh - ch - MARGIN));
  const below = spot.y + spot.h + GAP;
  const above = spot.y - GAP - ch;
  const right = spot.x + spot.w + GAP;
  const left = spot.x - GAP - cw;
  if (below + ch <= vh - MARGIN) return { x: cx, y: below, dock: "float" };
  if (above >= MARGIN) return { x: cx, y: above, dock: "float" };
  if (right + cw <= vw - MARGIN) return { x: right, y: cy, dock: "float" };
  if (left >= MARGIN) return { x: left, y: cy, dock: "float" };
  return { x: cx, y: Math.max(MARGIN, vh - ch - MARGIN), dock: "float" };
}

const sameGeom = (a: Geom | null, b: Geom) =>
  !!a &&
  a.x === b.x &&
  a.y === b.y &&
  a.dock === b.dock &&
  a.vw === b.vw &&
  a.vh === b.vh &&
  (a.spot === null) === (b.spot === null) &&
  (!a.spot || !b.spot || (a.spot.x === b.spot.x && a.spot.y === b.spot.y && a.spot.w === b.spot.w && a.spot.h === b.spot.h && a.spot.r === b.spot.r));

const setChip = (open: boolean) => window.dispatchEvent(new CustomEvent(TOUR_CHIP_EVENT, { detail: open }));

export function GuidedTour({ userId }: { userId: string }) {
  const t = useTranslations("tour");
  const tg = useTranslations("grade");
  const ts = useTranslations("status");
  const pathname = usePathname();
  const [step, setStep] = useState<number | null>(null);
  const [geom, setGeom] = useState<Geom | null>(null);
  const [settling, setSettling] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const bodyId = useId();
  const storageKey = `fasto.tour.v1:${userId}`;
  const open = step !== null;

  const start = useCallback(() => {
    const active = document.activeElement;
    returnTo.current = active instanceof HTMLElement && active !== document.body ? active : null;
    // Drop ?tour=1 so a reload or a shared link does not replay the tour.
    const url = new URL(window.location.href);
    if (url.searchParams.has("tour")) {
      url.searchParams.delete("tour");
      window.history.replaceState(null, "", url);
    }
    setGeom(null);
    setSettling(false);
    setStep(0);
  }, []);

  const finish = useCallback(
    (outcome: "done" | "skipped") => {
      endedThisLifetime = true;
      try {
        window.localStorage.setItem(storageKey, outcome);
      } catch {
        // Storage unavailable (private mode, blocked): the flag above covers this page lifetime.
      }
      setStep(null);
    },
    [storageKey],
  );

  const go = useCallback((delta: number) => {
    setStep((s) => {
      if (s === null) return s;
      const next = clamp(s + delta, 0, STEPS.length - 1);
      if (next !== s) setSettling(true);
      return next;
    });
  }, []);

  // Decide whether to start: Scout route only, after the intro, once per user.
  useEffect(() => {
    if (pathname !== "/") {
      setStep(null);
      return;
    }
    const forced = /[?&]tour=1(?:&|$)/.test(window.location.search);
    if (!forced) {
      if (navigator.webdriver || endedThisLifetime) return;
      try {
        const seen = window.localStorage.getItem(storageKey);
        if (seen === "done" || seen === "skipped") return;
      } catch {
        // Unreadable storage: show it once, `endedThisLifetime` stops a second run.
      }
    }
    const html = document.documentElement;
    let timer = 0;
    const observer = new MutationObserver(() => arm());
    const arm = () => {
      window.clearTimeout(timer);
      if (html.hasAttribute(INTRO_ATTR)) return; // the observer calls back when the intro ends
      timer = window.setTimeout(() => {
        if (html.hasAttribute(INTRO_ATTR)) return;
        observer.disconnect();
        start();
      }, START_DELAY_MS);
    };
    observer.observe(html, { attributes: true, attributeFilter: [INTRO_ATTR] });
    arm();
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [pathname, storageKey, start]);

  // Follow the target every frame while open: resize, scroll, the chip opening, the flower moving.
  useEffect(() => {
    if (step === null) return;
    const current = STEPS[step];
    let raf = 0;
    const tick = () => {
      const r = root.current;
      const c = card.current;
      if (r && c) {
        const vw = r.clientWidth;
        const vh = r.clientHeight;
        const spot = measure(current, vw, vh);
        const next: Geom = { spot, ...place(spot, c.offsetWidth, c.offsetHeight, vw, vh), vw, vh };
        setGeom((prev) => (sameGeom(prev, next) ? prev : next));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  // Per step: bring an off-screen target into view, and hold the header chip open for the Ask step.
  useEffect(() => {
    if (step === null) return;
    const current = STEPS[step];
    setChip(!!current.openChip);
    const el = find(current.targets);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) {
        const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        el.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
      }
    }
    const id = window.setTimeout(() => setSettling(false), SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [step]);

  // Focus goes into the card when the tour opens and stays there; it goes back where it was at the end.
  useEffect(() => {
    if (!open) return;
    card.current?.focus({ preventScroll: true });
    return () => {
      setChip(false);
      const el = returnTo.current;
      returnTo.current = null;
      if (el?.isConnected) el.focus({ preventScroll: true });
    };
  }, [open]);
  useEffect(() => {
    // The Back button leaves the DOM on the first step: never let focus fall out of the dialog.
    if (step !== null && card.current && !card.current.contains(document.activeElement)) card.current.focus({ preventScroll: true });
  }, [step]);

  // Keyboard, ahead of the page's own handlers: arrows move, Escape skips, Tab stays in the card.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "Escape") finish("skipped");
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Tab") {
        const c = card.current;
        if (!c) return;
        const items = Array.from(c.querySelectorAll<HTMLElement>("button:not([disabled])"));
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (!c.contains(active) || active === c) (e.shiftKey ? last : first)?.focus();
        else if (e.shiftKey && active === first) last?.focus();
        else if (!e.shiftKey && active === last) first?.focus();
        else return; // the browser moves focus between the card's own buttons
      } else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, finish, go]);

  if (step === null) return null;
  const current = STEPS[step];
  const last = step === STEPS.length - 1;
  const spot = geom?.spot ?? null;
  // Without a target the cut-out closes to a point in the middle: the whole page is dimmed.
  const hole = spot ?? { x: Math.round((geom?.vw ?? 0) / 2), y: Math.round((geom?.vh ?? 0) / 2), w: 0, h: 0, r: 0 };

  return createPortal(
    <div
      ref={root}
      data-testid="tour"
      data-step={current.key}
      data-settling={settling}
      className="tour fixed inset-0 z-[70] overflow-hidden"
    >
      {/* Takes every click and tap: nothing under the tour reacts, and a click outside the card does nothing. */}
      <div aria-hidden data-testid="tour-backdrop" className="absolute inset-0" onMouseDown={(e) => e.preventDefault()} />
      <div
        aria-hidden
        data-testid="tour-spotlight"
        data-target={spot ? "true" : "false"}
        className="tour-spot"
        style={{ width: hole.w, height: hole.h, borderRadius: hole.r, transform: `translate3d(${hole.x}px, ${hole.y}px, 0)` }}
      />
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        data-testid="tour-card"
        data-dock={geom?.dock ?? "float"}
        className={cn(
          "tour-card absolute top-0 left-0 w-[22rem] max-w-[calc(100vw-1.5rem)] rounded-[var(--radius-card)] border border-border bg-surface text-text shadow-e3 outline-none",
          "max-sm:w-full max-sm:max-w-none max-sm:border-x-0",
          "max-sm:data-[dock=bottom]:rounded-t-[var(--radius-tray)] max-sm:data-[dock=bottom]:rounded-b-none max-sm:data-[dock=bottom]:border-b-0 max-sm:data-[dock=bottom]:pb-[env(safe-area-inset-bottom)]",
          "max-sm:data-[dock=top]:rounded-t-none max-sm:data-[dock=top]:rounded-b-[var(--radius-tray)] max-sm:data-[dock=top]:border-t-0 max-sm:data-[dock=top]:pt-[env(safe-area-inset-top)]",
          !geom && "opacity-0",
        )}
        style={{ transform: `translate3d(${geom?.x ?? 0}px, ${geom?.y ?? 0}px, 0)` }}
      >
        <div className="animate-[fade_var(--dur-slow)_var(--ease-out)] p-5">
          <div className="flex items-center gap-3">
            <p className="t-label num shrink-0">
              <span aria-hidden data-testid="tour-counter">
                {t("counter", { current: step + 1, total: STEPS.length })}
              </span>
              <span className="sr-only">{t("counterLabel", { current: step + 1, total: STEPS.length })}</span>
            </p>
            {/* Thin progress bar: one segment per step. The counter beside it says the same in words. */}
            <div aria-hidden className="flex flex-1 gap-1">
              {STEPS.map((s, i) => (
                <span
                  key={s.key}
                  className={cn("h-1 flex-1 rounded-full transition-colors duration-(--dur-base)", i <= step ? "bg-brand" : "bg-surface-3")}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => finish("skipped")}
              className="-my-2 -mr-2 flex min-h-11 shrink-0 items-center rounded-full px-2 text-xs font-medium text-muted underline-offset-4 hover:text-text hover:underline"
            >
              {t("skip")}
            </button>
          </div>

          <div aria-live="polite" className="mt-2">
            <div key={current.key} className="animate-[fade_var(--dur-base)_var(--ease-out)]">
              <h2 id={titleId} className="t-h2">
                {t(`steps.${current.key}.title`)}
              </h2>
              <div id={bodyId}>
                <p className="mt-1.5 text-[15px] leading-relaxed">{t(`steps.${current.key}.body`)}</p>
                {current.key === "verdict" && (
                  <ul className="mt-3 grid gap-2 text-sm max-sm:grid-cols-2" data-testid="tour-grades">
                    {(["A", "B", "C"] as const).map((g) => (
                      <li key={g} className="flex items-center gap-2.5">
                        <GradeBadge grade={g} />
                        {tg(g)}
                      </li>
                    ))}
                    <li className="flex items-center gap-2.5">
                      <span aria-hidden className="hatched size-5 flex-none rounded-[6px] border border-border-strong" />
                      {ts("insufficient_data")}
                    </li>
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            {step > 0 && (
              <button type="button" onClick={() => go(-1)} className="btn btn-ghost">
                {t("back")}
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? finish("done") : go(1))}
              className="btn btn-primary max-sm:flex-1"
            >
              {last ? t("done") : t("next")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
