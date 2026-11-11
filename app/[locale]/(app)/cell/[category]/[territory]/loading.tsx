import { useTranslations } from "next-intl";

export default function Loading() {
  const t = useTranslations("common");
  return (
    <div role="status" aria-busy="true" className="space-y-4 px-4 py-8">
      <span className="sr-only">{t("loading")}</span>
      <div className="hatched h-24 w-44 animate-pulse rounded-[var(--radius-card)]" />
      <div className="h-8 w-2/3 animate-pulse rounded-lg bg-surface-2" />
      <div className="h-11 w-full animate-pulse rounded-lg bg-surface" />
      <div className="h-48 w-full animate-pulse rounded-[var(--radius-card)] bg-surface" />
    </div>
  );
}
