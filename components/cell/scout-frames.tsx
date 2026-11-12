"use client";
import { useTranslations } from "next-intl";
import type { ScoutFigure } from "@/app/[locale]/(app)/scout-actions";
import { Link } from "@/lib/i18n/navigation";
import { useFigureText } from "@/components/sheet/figure-value";
import { cn } from "@/lib/utils";
import { GradeBadge } from "./grade-badge";

/**
 * Slots keep clear of the centre column (the status block). Desktop uses eight, phones the first four
 * (hidden below sm via the `phone` flag). Position and size are percentages and rem so they scale.
 */
type Slot = { cls: string; phone: boolean; dx: number; dy: number; delay: number; dur: number };
const SLOTS: Slot[] = [
  { cls: "left-[3%] top-[17%] w-[min(17rem,24%)]", phone: true, dx: 8, dy: -10, delay: 0, dur: 11 },
  { cls: "left-[72%] top-[14%] w-[min(15rem,22%)]", phone: true, dx: -6, dy: 12, delay: 1.5, dur: 13 },
  { cls: "left-[11%] top-[41%] w-[min(14rem,20%)]", phone: false, dx: 10, dy: 8, delay: 0.8, dur: 12 },
  { cls: "left-[74%] top-[38%] w-[min(17rem,24%)]", phone: false, dx: -9, dy: -8, delay: 2.2, dur: 14 },
  { cls: "left-[4%] top-[63%] w-[min(17rem,24%)]", phone: true, dx: 6, dy: -12, delay: 3, dur: 12 },
  { cls: "left-[70%] top-[61%] w-[min(14.5rem,21%)]", phone: true, dx: -10, dy: 10, delay: 0.4, dur: 15 },
  { cls: "left-[15%] top-[81%] w-[min(15rem,21%)]", phone: false, dx: 8, dy: 6, delay: 1.1, dur: 13 },
  { cls: "left-[79%] top-[79%] w-[min(13.5rem,19%)]", phone: false, dx: -7, dy: -10, delay: 2.6, dur: 11 },
];

// Phone placement overrides the desktop one: four small frames around and below the status (slots 0, 1, 4, 5).
const PHONE_POS = [
  "max-sm:left-[3%] max-sm:top-[calc(var(--header-h,96px)+0.25rem)] max-sm:w-[45%]",
  "max-sm:left-[52%] max-sm:top-[calc(var(--header-h,96px)+2.75rem)] max-sm:w-[45%]",
  "",
  "",
  "max-sm:left-[3%] max-sm:top-[71%] max-sm:w-[45%]",
  "max-sm:left-[52%] max-sm:top-[77%] max-sm:w-[45%]",
  "",
  "",
];

const shell = "absolute rounded-2xl border border-border px-3 py-2 text-left sm:rounded-[var(--radius-card)] sm:px-4 sm:py-3";

function Wrap({ slot, i, children, shown, hatched }: { slot: Slot; i: number; children: React.ReactNode; shown: boolean; hatched?: boolean }) {
  return (
    <li
      className={cn(
        "transition-opacity duration-500 motion-reduce:transition-none",
        slot.cls,
        PHONE_POS[i],
        !slot.phone && "max-sm:hidden",
        shell,
        hatched ? "hatched" : "bg-surface",
        shown ? "pointer-events-auto opacity-45 focus-within:opacity-100 hover:opacity-100 max-sm:opacity-85" : "pointer-events-none opacity-0",
      )}
      style={{ ["--dx" as string]: `${slot.dx}px`, ["--dy" as string]: `${slot.dy}px`, animation: `drift ${slot.dur}s ease-in-out ${slot.delay}s infinite` }}
    >
      {children}
    </li>
  );
}

export function ScoutFrames({
  figures,
  loading,
  visible,
  href,
}: {
  figures: ScoutFigure[] | null;
  loading: boolean;
  visible: boolean;
  href: string;
}) {
  const t = useTranslations("scout");
  const tf = useTranslations("sheet.figure");
  const text = useFigureText();

  const shown = (figures ?? []).slice(0, SLOTS.length);

  return (
    <ul
      aria-label={t("framesLabel")}
      aria-busy={loading}
      data-testid="scout-frames"
      className={cn("pointer-events-none absolute inset-0 z-0 m-0 list-none p-0", !visible && "invisible")}
    >
      {!figures &&
        SLOTS.map((s, i) => (
          <Wrap key={i} slot={s} i={i} shown={visible}>
            <div role="status" aria-label={t("framesLoading")} className="h-16 animate-pulse rounded-lg bg-surface-2 opacity-60" />
          </Wrap>
        ))}
      {figures &&
        shown.map((f, i) => {
          const missing = f.figure.value == null || f.figure.grade == null;
          const label = t(`frame.${f.key}`);
          const value = text(f.figure);
          const range =
            !missing && f.figure.low != null && f.figure.high != null
              ? t("range", { low: text(f.figure, f.figure.low), high: text(f.figure, f.figure.high) })
              : null;
          return (
            <Wrap key={f.key} slot={SLOTS[i]} i={i} shown={visible} hatched={missing}>
              <Link
                href={href}
                tabIndex={visible ? 0 : -1}
                aria-label={t("openFrame", { label, value })}
                className={cn("block rounded-[inherit] outline-offset-4", loading && "opacity-60")}
              >
                <span className="block text-[10px] font-medium tracking-wider text-muted uppercase sm:text-xs">{label}</span>
                {missing ? (
                  <span className="mt-1 block text-sm" title={tf("insufficientHint")}>
                    {tf("insufficient")}
                  </span>
                ) : (
                  <span className="mt-1 flex items-center gap-2">
                    <span className="num text-lg font-light sm:text-2xl">{value}</span>
                    <GradeBadge grade={f.figure.grade!} />
                  </span>
                )}
                {range && <span className="num mt-0.5 block text-[10px] text-muted sm:text-xs">{range}</span>}
              </Link>
            </Wrap>
          );
        })}
    </ul>
  );
}
