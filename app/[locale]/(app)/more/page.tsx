import { ChevronRight, Map as MapIcon } from "lucide-react";
import { cookies } from "next/headers";
import { getStaffRole } from "@/lib/admin";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { setTheme, signOut } from "./actions";

export default async function MorePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("more");
  const theme = (await cookies()).get("theme")?.value === "light" ? "light" : "dark";
  const { email } = await requireUser();
  const ta = await getTranslations("admin");
  const tm = await getTranslations("map");
  const { role } = await getStaffRole();

  const seg = (active: boolean) =>
    cn("seg-item w-full", active && "bg-brand text-brand-contrast shadow-e1 hover:text-brand-contrast");

  return (
    <div className="page max-w-md space-y-4">
      <h1 className="t-h1 pb-2">{t("title")}</h1>

      <section className="card space-y-2 p-5">
        <h2 className="t-label">{t("account")}</h2>
        <p className="truncate">{email}</p>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="t-label">{t("theme")}</h2>
        <div className="seg flex bg-surface-2">
          <form action={setTheme.bind(null, "dark")} className="flex flex-1">
            <button className={seg(theme === "dark")} aria-pressed={theme === "dark"}>{t("dark")}</button>
          </form>
          <form action={setTheme.bind(null, "light")} className="flex flex-1">
            <button className={seg(theme === "light")} aria-pressed={theme === "light"}>{t("light")}</button>
          </form>
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="t-label">{t("language")}</h2>
        <div className="seg flex bg-surface-2">
          <Link href="/more" locale="it" className={seg(locale === "it")} aria-current={locale === "it" ? "true" : undefined}>
            Italiano
          </Link>
          <Link href="/more" locale="en" className={seg(locale === "en")} aria-current={locale === "en" ? "true" : undefined}>
            English
          </Link>
        </div>
      </section>

      <Link href="/map" className="card card-link group flex min-h-12 items-center justify-between p-5">
        <span className="flex items-center gap-3">
          <MapIcon aria-hidden className="size-5 text-muted" />
          {tm("link")}
        </span>
        <ChevronRight aria-hidden className="size-4 text-muted transition-transform duration-(--dur-base) group-hover:translate-x-0.5 group-hover:text-text" />
      </Link>

      {role && (
        <Link href="/admin" className="card card-link group flex min-h-12 items-center justify-between p-5">
          {ta("link")}
          <ChevronRight aria-hidden className="size-4 text-muted transition-transform duration-(--dur-base) group-hover:translate-x-0.5 group-hover:text-text" />
        </Link>
      )}

      <form action={signOut}>
        <button className="btn btn-quiet mt-2 h-12 w-full">{t("signOut")}</button>
      </form>
    </div>
  );
}
