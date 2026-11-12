"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Compass, Grid3x3, MessageCircleQuestion } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", key: "scout", Icon: Compass },
  { href: "/matrix", key: "matrix", Icon: Grid3x3 },
  { href: "/ask", key: "ask", Icon: MessageCircleQuestion },
] as const;

/** Brand pill: shows the active page icon, expands into the three page choices. */
export function PageChip() {
  const t = useTranslations("nav");
  const ts = useTranslations("shell");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const panelId = useId();
  const lastPointer = useRef("");

  const active = ITEMS.find(({ href }) => (href === "/" ? pathname === "/" : pathname.startsWith(href)));
  const current = active ?? ITEMS[0];
  const ActiveIcon = current.Icon;

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && open) {
      setOpen(false);
      ref.current?.querySelector<HTMLElement>("button")?.focus();
    }
    if (open && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      const els = Array.from(ref.current?.querySelectorAll<HTMLElement>("button, a") ?? []);
      const i = els.indexOf(document.activeElement as HTMLElement);
      if (i >= 0) {
        e.preventDefault();
        els[(i + (e.key === "ArrowRight" ? 1 : els.length - 1)) % els.length]?.focus();
      }
    }
  };

  return (
    <nav
      ref={ref}
      aria-label={t("main")}
      onKeyDown={onKeyDown}
      onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
      data-open={open}
      className="pointer-events-auto flex items-center rounded-full bg-brand text-brand-contrast shadow-e2 ring-1 ring-inset ring-white/15 transition-shadow duration-(--dur-slow) data-[open=true]:shadow-e3"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={ts("chipLabel", { page: t(current.key) })}
        onPointerDown={(e) => (lastPointer.current = e.pointerType)}
        onClick={() => {
          // With a mouse the hover already opened it: a click keeps it open.
          const viaMouse = lastPointer.current === "mouse";
          lastPointer.current = "";
          setOpen((o) => (viaMouse ? true : !o));
        }}
        className="flex min-h-11 items-center gap-2.5 rounded-full px-4 text-[13px] font-bold tracking-[0.12em] uppercase transition-transform duration-(--dur-fast) active:scale-[0.97]"
      >
        {/* Slot: a logo image can replace this text later. */}
        <span data-slot="logo" className={cn("whitespace-nowrap", open && "max-sm:hidden")}>{ts("brand")}</span>
        <span aria-hidden className={cn("h-4 w-px bg-brand-contrast/30", open && "max-sm:hidden")} />
        <ActiveIcon aria-hidden strokeWidth={2.25} className="size-[18px]" />
      </button>
      <div
        id={panelId}
        className={cn(
          "grid transition-[grid-template-columns,opacity,visibility] duration-(--dur-slow) ease-out motion-reduce:transition-none",
          open ? "visible grid-cols-[1fr] opacity-100" : "invisible grid-cols-[0fr] opacity-0",
        )}
      >
        <ul className="flex min-w-0 items-center gap-0.5 overflow-hidden pr-1 whitespace-nowrap">
          {ITEMS.map(({ href, key, Icon }) => {
            const isActive = active?.key === key;
            return (
              <li key={key}>
                {/* 44 px hit area; the visible pill and its focus ring sit inside the chip. */}
                <Link href={href} aria-current={isActive ? "page" : undefined} className="group flex min-h-11 items-center focus-visible:!outline-0">
                  <span
                    className={cn(
                      "flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold tracking-[0.1em] uppercase ring-brand-contrast ring-offset-2 ring-offset-brand transition-[background-color,color,transform] duration-(--dur-base) group-focus-visible:ring-2 group-active:scale-[0.96] sm:gap-2 sm:px-3.5",
                      isActive ? "bg-brand-contrast text-brand" : "group-hover:bg-brand-contrast/12",
                    )}
                  >
                    <Icon aria-hidden className="size-4 max-sm:hidden" />
                    {t(key)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
