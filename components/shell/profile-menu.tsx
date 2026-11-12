"use client";
import { useEffect, useId, useRef, useState } from "react";
import { LogOut, Map as MapIcon, Moon, Settings, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { setTheme, signOut } from "@/app/[locale]/(app)/more/actions";
import { cn } from "@/lib/utils";

const ITEM =
  "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand";

export function ProfileMenu({ email, isStaff, theme }: { email: string; isStaff: boolean; theme: "dark" | "light" }) {
  const t = useTranslations("shell");
  const tm = useTranslations("more");
  const ta = useTranslations("admin");
  const tmap = useTranslations("map");
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const initial = (email.trim()[0] ?? "?").toUpperCase();
  const nextTheme = theme === "dark" ? "light" : "dark";

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const raf = window.setTimeout(() => ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(), 60);
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.clearTimeout(raf);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "Escape") {
      setOpen(false);
      ref.current?.querySelector<HTMLElement>("button[aria-haspopup]")?.focus();
      return;
    }
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    const move = (n: number) => {
      e.preventDefault();
      items[(n + items.length) % items.length]?.focus();
    };
    if (e.key === "ArrowDown") move(i + 1);
    else if (e.key === "ArrowUp") move(i - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(items.length - 1);
    else if (e.key === "Tab") setOpen(false);
  };

  return (
    <div ref={ref} onKeyDown={onKeyDown} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t("profile")}
        onClick={() => setOpen((o) => !o)}
        className="grid size-11 place-items-center rounded-full bg-surface-2 text-sm font-semibold uppercase text-text ring-1 ring-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {initial}
      </button>
      <div
        id={menuId}
        role="menu"
        aria-label={t("profileMenu")}
        className={cn(
          "absolute right-0 top-13 w-64 origin-top-right rounded-2xl border border-border bg-surface p-2 shadow-xl transition-[opacity,transform,visibility] duration-200 motion-reduce:transition-none",
          open ? "visible scale-100 opacity-100" : "invisible scale-95 opacity-0",
        )}
      >
        <p className="truncate px-3 py-2 text-xs text-muted">{t("signedInAs", { email })}</p>
        <form action={setTheme.bind(null, nextTheme)}>
          <button role="menuitem" tabIndex={-1} className={ITEM}>
            {theme === "dark" ? <Sun aria-hidden className="size-4" /> : <Moon aria-hidden className="size-4" />}
            {tm("theme")}: {theme === "dark" ? tm("light") : tm("dark")}
          </button>
        </form>
        <div className="flex items-center gap-1 px-3 py-1">
          <span className="mr-auto text-sm">{tm("language")}</span>
          {(["it", "en"] as const).map((l) => (
            <Link
              key={l}
              role="menuitem"
              tabIndex={-1}
              href={pathname}
              locale={l}
              aria-current={locale === l ? "true" : undefined}
              className={cn(
                "grid min-h-11 min-w-11 place-items-center rounded-full px-3 text-xs font-semibold uppercase focus-visible:outline-2 focus-visible:outline-brand",
                locale === l ? "bg-brand text-brand-contrast" : "text-muted hover:text-text",
              )}
            >
              {l}
            </Link>
          ))}
        </div>
        <Link role="menuitem" tabIndex={-1} href="/map" className={ITEM}>
          <MapIcon aria-hidden className="size-4" />
          {tmap("title")}
        </Link>
        {isStaff && (
          <Link role="menuitem" tabIndex={-1} href="/admin" className={ITEM}>
            <Settings aria-hidden className="size-4" />
            {ta("link")}
          </Link>
        )}
        <form action={signOut}>
          <button role="menuitem" tabIndex={-1} className={ITEM}>
            <LogOut aria-hidden className="size-4" />
            {tm("signOut")}
          </button>
        </form>
      </div>
    </div>
  );
}
