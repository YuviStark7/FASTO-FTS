import { useTranslations } from "next-intl";

export default function Loading() {
  const t = useTranslations("common");
  return (
    <div role="status" aria-busy="true" className="grid min-h-[70dvh] place-items-center">
      <div className="flex flex-col items-center gap-5">
        <div className="skeleton h-3 w-40" />
        <div className="skeleton h-12 w-72 max-w-[80vw]" />
        <div className="flex gap-3">
          <div className="skeleton h-11 w-36 rounded-full" />
          <div className="skeleton h-11 w-36 rounded-full" />
        </div>
        <span className="sr-only">{t("loading")}</span>
      </div>
    </div>
  );
}
