import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";

export default function CellNotFound() {
  const t = useTranslations("sheet.notFound");
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div className="space-y-4">
        <h1 className="text-2xl font-light">{t("title")}</h1>
        <p className="text-muted">{t("body")}</p>
        <Link href="/matrix" className="inline-flex h-11 items-center rounded-full bg-brand px-6 text-brand-contrast">
          {t("link")}
        </Link>
      </div>
    </div>
  );
}
