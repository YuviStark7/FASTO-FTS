import { useTranslations } from "next-intl";

export default function Loading() {
  const t = useTranslations("common");
  return (
    <div role="status" className="space-y-3 p-4 lg:p-8">
      <div className="h-8 w-40 animate-pulse rounded-md bg-surface-2" />
      <div className="hatched h-[50dvh] animate-pulse rounded-[var(--radius-card)] opacity-60" />
      <span className="sr-only">{t("loading")}</span>
    </div>
  );
}
