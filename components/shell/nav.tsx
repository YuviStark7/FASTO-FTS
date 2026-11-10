"use client";
import { Compass, Grid3x3, MessageCircleQuestion, Ellipsis } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", key: "scout", Icon: Compass },
  { href: "/matrix", key: "matrix", Icon: Grid3x3 },
  { href: "/ask", key: "ask", Icon: MessageCircleQuestion },
  { href: "/more", key: "more", Icon: Ellipsis },
] as const;

/** Bottom bar under 1024 px, left rail with labels above. SPEC section 7, layout by breakpoint. */
export function Nav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav
      aria-label={t("main")}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur",
        "pb-[env(safe-area-inset-bottom)]",
        "lg:inset-y-0 lg:left-0 lg:right-auto lg:w-56 lg:border-t-0 lg:border-r lg:pb-0",
      )}
    >
      <div className="hidden px-5 pt-6 pb-8 lg:flex lg:items-center lg:gap-2">
        <span aria-hidden className="grid size-8 place-items-center rounded-full bg-brand text-xs font-bold text-brand-contrast">
          FT
        </span>
        <span className="text-sm font-semibold tracking-wide">FASTO FTS</span>
      </div>
      <ul className="mx-auto flex max-w-md justify-around lg:mx-0 lg:max-w-none lg:flex-col lg:gap-1 lg:px-3">
        {ITEMS.map(({ href, key, Icon }) => {
          const active = isActive(href);
          return (
            <li key={key} className="lg:w-full">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 min-w-16 flex-col items-center justify-center gap-1 rounded-2xl px-3 text-[11px] transition-colors",
                  "lg:min-h-11 lg:w-full lg:flex-row lg:justify-start lg:gap-3 lg:text-sm",
                  active ? "text-brand lg:bg-surface-2" : "text-muted hover:text-text",
                )}
              >
                <Icon aria-hidden className="size-5" strokeWidth={active ? 2.2 : 1.6} />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
