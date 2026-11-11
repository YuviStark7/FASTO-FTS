import { Database, ListChecks, MessageSquareQuote } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";

export default async function AdminIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const tf = await getTranslations("feedback");
  const tiles = [
    { href: "/admin/sources", Icon: Database, title: t("tiles.sources"), hint: t("tiles.sourcesHint") },
    { href: "/admin/runs", Icon: ListChecks, title: t("tiles.runs"), hint: t("tiles.runsHint") },
    { href: "/admin/feedback", Icon: MessageSquareQuote, title: tf("tileTitle"), hint: tf("tileHint") },
  ] as const;
  return (
    <>
      <header>
        <h1 className="text-4xl font-light tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("lead")}</p>
      </header>
      <ul className="grid grid-cols-2 gap-3 lg:max-w-xl">
        {tiles.map(({ href, Icon, title, hint }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-40 flex-col justify-between gap-4 rounded-[var(--radius-card)] bg-surface-2 p-4 hover:bg-surface">
              <Icon aria-hidden className="size-7 text-brand" />
              <span>
                <span className="block text-lg font-medium">{title}</span>
                <span className="block text-sm text-muted">{hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
