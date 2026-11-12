import { useTranslations } from "next-intl";

/** Mirrors the sheet: verdict column, tab bar, panels. Never hatched: hatched means unknown, not loading. */
export default function Loading() {
  const t = useTranslations("common");
  return (
    <div role="status" aria-busy="true" className="lg:grid lg:grid-cols-[380px_1fr]">
      <span className="sr-only">{t("loading")}</span>
      <div className="space-y-5 px-4 pt-2 pb-6 lg:px-8 lg:pt-4">
        <div className="skeleton h-5 w-36" />
        <div className="flex gap-3">
          <div className="skeleton h-24 w-20 rounded-[var(--radius-card)]" />
          <div className="skeleton h-24 w-20 rounded-[var(--radius-card)]" />
        </div>
        <div className="skeleton h-9 w-3/4" />
        <div className="skeleton h-5 w-1/2" />
        <div className="skeleton h-1 w-full" />
      </div>
      <div className="space-y-4 px-4 py-5 lg:px-8">
        <div className="skeleton h-12 w-full" />
        <div className="skeleton h-44 w-full rounded-[var(--radius-card)]" />
        <div className="skeleton h-72 w-full rounded-[var(--radius-card)]" />
      </div>
    </div>
  );
}
