import { useTranslations } from "next-intl";
import type { Category } from "@/lib/queries/scout";
import { routing } from "@/lib/i18n/routing";
import { CategoryIcon } from "./category-icon";

/**
 * First-visit intro on the Scout landing page (about 2.5 s, never more than 3 s).
 *
 * The choreography is CSS only (app/globals.css, "Scout first-visit intro"), driven by one attribute
 * on <html>: `data-scout-intro="pending"` (brand on the page background, waiting for the Scout data)
 * then `"play"` (petals bloom and circle, settle into the Scout chips, header chip and profile badge
 * float down, verdict floats up). Removing the attribute is the final state: the real Scout UI is
 * server-rendered underneath from the start, nothing here delays data or hydration.
 *
 * Two inline scripts decide and drive it before first paint, without waiting for React:
 *  - ScoutIntroGate (app layout): plays on every full page load (or reload) of the Scout landing
 *    route; the script never runs again on client navigations, so moving around the app does not
 *    replay it. Never with reduced motion. Never under automation (`navigator.webdriver`) unless the
 *    URL carries `?intro=1`.
 *  - ScoutIntroPetals (Scout page): starts the choreography once the petals are on screen.
 * Any pointer press or key press ends it at once.
 */

/** Total length of the choreography; the last animation (verdict) ends at 2450 ms. */
const PLAY_MS = 2500;
/** If the Scout page has not arrived by then, give up and show the normal loading state. */
const PENDING_MS = 2000;

const gateScript = () => `(function(){try{
var d=document.documentElement,A="data-scout-intro",w=window,t;
if(!/^\\/(?:${routing.locales.join("|")})?\\/?$/.test(location.pathname))return;
if(w.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
if(navigator.webdriver&&!/[?&]intro=1(?:&|$)/.test(location.search))return;
function end(){clearTimeout(t);d.removeAttribute(A);w.removeEventListener("pointerdown",skip,true);w.removeEventListener("keydown",end,true)}
function skip(){end();
function c(e){e.preventDefault();e.stopPropagation();w.removeEventListener("click",c,true)}
w.addEventListener("click",c,true);setTimeout(function(){w.removeEventListener("click",c,true)},600)}
w.__fastoIntro=function(){if(d.getAttribute(A)!=="pending")return;d.setAttribute(A,"play");clearTimeout(t);t=setTimeout(end,${PLAY_MS})};
d.setAttribute(A,"pending");
w.addEventListener("pointerdown",skip,true);w.addEventListener("keydown",end,true);
t=setTimeout(end,${PENDING_MS});
}catch(e){}})()`;

// Streamed content sits in a hidden container until React reveals it: start on the frame the petals
// are really on screen, so they stay in step with the header and verdict animations.
const PLAY_SCRIPT = `(function(){var f=window.__fastoIntro,s=document.currentScript,n=0;if(!f||!s)return;
(function go(){if(!s.closest("[hidden]")||++n>240)f();else requestAnimationFrame(go)})()})()`;

/** Overlay (page background and brand) plus the script that decides whether the intro plays. */
export function ScoutIntroGate() {
  const t = useTranslations("shell");
  return (
    <>
      <div aria-hidden data-testid="scout-intro" className="scout-intro">
        <div className="scout-intro-bg" />
        {/* Slot: a logo image can replace this text later (same slot name as the header chip). */}
        <span data-slot="logo" className="scout-intro-brand text-[26px] font-bold tracking-[0.12em] whitespace-nowrap text-text uppercase sm:text-4xl">
          {t("brand")}
        </span>
      </div>
      <script dangerouslySetInnerHTML={{ __html: gateScript() }} />
    </>
  );
}

/** The 15 category petals, on a full ring around the brand. Same icons, colours and sizes as the Scout flower. */
export function ScoutIntroPetals({ categories }: { categories: Pick<Category, "slug" | "icon" | "color">[] }) {
  const step = 360 / Math.max(1, categories.length);
  return (
    <>
      <div
        aria-hidden
        data-testid="scout-intro-flower"
        // --R, --p and --b match the Scout flower zone, so the ring settles on the flower's resting point.
        className="scout-intro-flower [--R:150px] [--p:50px] sm:[--R:230px] sm:[--p:70px]"
      >
        <div className="scout-intro-ring">
          {categories.map((c, i) => (
            <div key={c.slug} className="scout-intro-petal" style={{ ["--a" as string]: `${i * step}deg`, ["--i" as string]: i }}>
              <div
                className="scout-intro-face grid place-items-center rounded-[18px] text-on-category shadow-e2 ring-1 ring-inset ring-white/20"
                style={{ backgroundColor: c.color }}
              >
                <CategoryIcon name={c.icon} className="size-6 sm:size-8" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: PLAY_SCRIPT }} />
    </>
  );
}
