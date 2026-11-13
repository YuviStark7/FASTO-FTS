import { useTranslations } from "next-intl";

/** Same frame as the loaded screen: weights beside the list from 1024 px, list first on phones. Never hatched. */
export default function Loading() {
  const t = useTranslations("common");
  return (
    <div role="status" aria-busy="true" className="page max-w-[1600px] space-y-5">
      <span className="sr-only">{t("loading")}</span>
      <div className="space-y-3 pb-2">
        <div className="skeleton h-10 w-52" />
        <div className="skeleton h-4 w-80 max-w-full" />
      </div>
      <div className="gap-8 lg:grid lg:grid-cols-[19rem_minmax(0,1fr)]">
        <div className="skeleton h-[28rem] rounded-[var(--radius-card)] max-lg:hidden" />
        <div className="space-y-5">
          <div className="flex gap-3">
            <div className="skeleton h-11 flex-1 sm:w-52 sm:flex-none" />
            <div className="skeleton h-11 flex-1 sm:w-44 sm:flex-none" />
          </div>
          <div className="space-y-2.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-36 rounded-[var(--radius-card)] wide:h-16" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
