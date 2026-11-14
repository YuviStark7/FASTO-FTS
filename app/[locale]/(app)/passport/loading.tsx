import { useTranslations } from "next-intl";

/** Same frame as the list: header, then passport cards. Never hatched: loading is not missing data. */
export default function Loading() {
  const t = useTranslations("common");
  return (
    <div role="status" aria-busy="true" className="page max-w-4xl space-y-6">
      <span className="sr-only">{t("loading")}</span>
      <div className="space-y-3 pb-2">
        <div className="skeleton h-10 w-72 max-w-full" />
        <div className="skeleton h-4 w-full max-w-xl" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-20 rounded-[var(--radius-card)]" />
        ))}
      </div>
    </div>
  );
}
