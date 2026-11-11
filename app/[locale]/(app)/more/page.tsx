import { ChevronRight } from "lucide-react";
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
  const { role } = await getStaffRole();

  const seg = (active: boolean) =>
    cn("flex min-h-11 flex-1 items-center justify-center rounded-full text-sm", active ? "bg-brand text-brand-contrast" : "text-muted");

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-10">
      <h1 className="text-4xl font-light tracking-tight">{t("title")}</h1>

      <section className="space-y-2 rounded-[var(--radius-card)] bg-surface p-5">
        <h2 className="text-sm text-muted">{t("account")}</h2>
        <p className="truncate">{email}</p>
      </section>

      <section className="space-y-3 rounded-[var(--radius-card)] bg-surface p-5">
        <h2 className="text-sm text-muted">{t("theme")}</h2>
        <div className="flex gap-1 rounded-full bg-surface-2 p-1">
          <form action={setTheme.bind(null, "dark")} className="flex flex-1">
            <button className={seg(theme === "dark")} aria-pressed={theme === "dark"}>{t("dark")}</button>
          </form>
          <form action={setTheme.bind(null, "light")} className="flex flex-1">
            <button className={seg(theme === "light")} aria-pressed={theme === "light"}>{t("light")}</button>
          </form>
        </div>
      </section>

      <section className="space-y-3 rounded-[var(--radius-card)] bg-surface p-5">
        <h2 className="text-sm text-muted">{t("language")}</h2>
        <div className="flex gap-1 rounded-full bg-surface-2 p-1">
          <Link href="/more" locale="it" className={seg(locale === "it")} aria-current={locale === "it" ? "true" : undefined}>
            Italiano
          </Link>
          <Link href="/more" locale="en" className={seg(locale === "en")} aria-current={locale === "en" ? "true" : undefined}>
            English
          </Link>
        </div>
      </section>

      {role && (
        <Link href="/admin" className="flex min-h-12 items-center justify-between rounded-[var(--radius-card)] bg-surface p-5">
          {ta("link")}
          <ChevronRight aria-hidden className="size-4 text-muted" />
        </Link>
      )}

      <form action={signOut}>
        <button className="h-12 w-full rounded-full bg-surface-2 text-text">{t("signOut")}</button>
      </form>
    </div>
  );
}
