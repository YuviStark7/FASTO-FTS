import { ArrowUpRight, Database, ListChecks, MessageSquareQuote } from "lucide-react";
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
      <header className="page-header">
        <h1 className="t-h1">{t("title")}</h1>
        <p className="t-lead">{t("lead")}</p>
      </header>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:max-w-4xl">
        {tiles.map(({ href, Icon, title, hint }) => (
          <li key={href}>
            <Link href={href} className="card card-link group flex h-full min-h-44 flex-col justify-between gap-4 p-4 sm:p-5">
              <span className="flex items-start justify-between">
                <span className="grid size-11 place-items-center rounded-[var(--radius-tile)] bg-surface-2 text-brand transition-colors duration-(--dur-base) group-hover:bg-surface-3">
                  <Icon aria-hidden strokeWidth={1.75} className="size-5" />
                </span>
                <ArrowUpRight aria-hidden className="size-4 text-muted transition-transform duration-(--dur-base) group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-text" />
              </span>
              <span>
                <span className="t-h2 block">{title}</span>
                <span className="mt-1 block text-sm leading-snug text-muted">{hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
