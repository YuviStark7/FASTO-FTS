import { useTranslations } from "next-intl";

export default function Loading() {
  const t = useTranslations("common");
  return (
    <div role="status" className="mx-auto max-w-6xl space-y-3 px-4 py-8 lg:px-8">
      <div className="h-8 w-48 animate-pulse rounded-md bg-surface-2" />
      <div className="hatched h-48 animate-pulse rounded-[var(--radius-card)] opacity-60" />
      <span className="sr-only">{t("loading")}</span>
    </div>
  );
}
