import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";

export default function CellNotFound() {
  const t = useTranslations("sheet.notFound");
  return (
    <div className="grid min-h-[70dvh] place-items-center px-4 text-center">
      <div className="max-w-md space-y-5">
        <h1 className="t-h1">{t("title")}</h1>
        <p className="text-muted">{t("body")}</p>
        <Link href="/matrix" className="btn btn-primary">
          {t("link")}
        </Link>
      </div>
    </div>
  );
}
