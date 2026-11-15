import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations("privacy");
  const sections = t.raw("sections") as { h: string; p: string }[];
  return (
    <main className="page mx-auto max-w-2xl space-y-6 py-10">
      <header className="space-y-1">
        <h1 className="t-h1">{t("title")}</h1>
        <p className="text-sm text-muted">{t("updated")}</p>
      </header>
      {sections.map((s) => (
        <section key={s.h} className="space-y-1.5">
          <h2 className="text-base font-semibold">{s.h}</h2>
          <p className="text-sm leading-relaxed text-muted">{s.p}</p>
        </section>
      ))}
      <Link href="/login" className="btn btn-ghost h-11">
        {t("back")}
      </Link>
    </main>
  );
}
