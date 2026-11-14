import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PassportForm } from "@/components/passport/passport-form";
import { Link } from "@/lib/i18n/navigation";
import { getPassportScreen } from "@/lib/queries/passports";

export default async function NewPassportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, { categories, canCreate }] = await Promise.all([getTranslations("passport"), getPassportScreen()]);

  return (
    <div className="page max-w-3xl space-y-6">
      <Link href="/passport" className="link inline-flex min-h-11 items-center gap-2 text-sm">
        <ArrowLeft aria-hidden className="size-4" />
        {t("detail.back")}
      </Link>
      <header className="page-header">
        <h1 className="t-h1">{t("form.titleNew")}</h1>
        <p className="t-lead">{t("form.leadNew")}</p>
      </header>
      {canCreate ? (
        <div className="card p-4 sm:p-6">
          <PassportForm passport={null} categories={categories} />
        </div>
      ) : (
        <p role="status" className="note" data-testid="passport-readonly">
          {t("list.viewer")}
        </p>
      )}
    </div>
  );
}
