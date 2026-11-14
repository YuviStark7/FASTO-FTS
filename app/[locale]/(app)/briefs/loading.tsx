import { useTranslations } from "next-intl";

export default function BriefsLoading() {
  const t = useTranslations("common");
  return (
    <div role="status" aria-busy="true" className="page max-w-4xl space-y-6">
      <div className="space-y-3">
        <div className="skeleton h-10 w-40" />
        <div className="skeleton h-4 w-72 max-w-full" />
      </div>
      <div className="space-y-3">
        <div className="skeleton h-20 rounded-[var(--radius-card)]" />
        <div className="skeleton h-20 rounded-[var(--radius-card)]" />
        <div className="skeleton h-20 rounded-[var(--radius-card)]" />
      </div>
      <span className="sr-only">{t("loading")}</span>
    </div>
  );
}
