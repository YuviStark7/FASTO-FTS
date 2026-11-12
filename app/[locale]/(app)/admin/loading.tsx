import { useTranslations } from "next-intl";

export default function Loading() {
  const t = useTranslations("common");
  return (
    <div role="status" aria-busy="true" className="page max-w-6xl space-y-6">
      <div className="skeleton h-10 w-56" />
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="skeleton h-48 rounded-[var(--radius-card)]" />
        <div className="skeleton h-48 rounded-[var(--radius-card)]" />
      </div>
      <span className="sr-only">{t("loading")}</span>
    </div>
  );
}
