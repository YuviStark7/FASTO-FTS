import { useTranslations } from "next-intl";

/** Rendered inside the admin layout, which already provides the page frame. */
export default function Loading() {
  const t = useTranslations("common");
  return (
    <div role="status" aria-busy="true" className="space-y-6">
      <div className="skeleton h-10 w-72 max-w-full" />
      <div className="skeleton h-32 rounded-[var(--radius-card)]" />
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-40 rounded-[var(--radius-card)]" />
        ))}
      </div>
      <span className="sr-only">{t("loading")}</span>
    </div>
  );
}
