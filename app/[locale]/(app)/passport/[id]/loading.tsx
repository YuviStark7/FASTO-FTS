import { useTranslations } from "next-intl";

/** Same frame as the passport page: the Fit table beside the form from 1024 px, Fit first on phones. */
export default function Loading() {
  const t = useTranslations("common");
  return (
    <div role="status" aria-busy="true" className="page max-w-[1400px] space-y-6">
      <span className="sr-only">{t("loading")}</span>
      <div className="skeleton h-5 w-40" />
      <div className="space-y-3 pb-2">
        <div className="skeleton h-10 w-72 max-w-full" />
        <div className="skeleton h-4 w-40" />
      </div>
      <div className="gap-8 space-y-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:space-y-0">
        <div className="space-y-5">
          <div className="skeleton h-24 rounded-[var(--radius-card)]" />
          <div className="skeleton h-[40rem] rounded-[var(--radius-card)]" />
        </div>
        <div className="skeleton h-[40rem] rounded-[var(--radius-card)]" />
      </div>
    </div>
  );
}
