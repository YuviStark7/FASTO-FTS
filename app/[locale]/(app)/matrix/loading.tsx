import { useTranslations } from "next-intl";

/** Same frame as the loaded screen, so nothing jumps when the data arrives. Never hatched: hatched means unknown. */
export default function Loading() {
  const t = useTranslations("common");
  return (
    <div role="status" aria-busy="true" className="page max-w-[1800px] space-y-5">
      <span className="sr-only">{t("loading")}</span>
      <div className="space-y-3 pb-2">
        <div className="skeleton h-10 w-44" />
        <div className="skeleton h-4 w-72 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="skeleton h-11 w-64 rounded-full" />
        <div className="skeleton h-11 w-40 max-sm:hidden" />
        <div className="skeleton h-11 w-40 max-sm:hidden" />
      </div>
      <div className="skeleton h-[52dvh] rounded-[var(--radius-card)]" />
    </div>
  );
}
