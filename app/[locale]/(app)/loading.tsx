import { useTranslations } from "next-intl";

export default function Loading() {
  const t = useTranslations("common");
  return (
    <div role="status" className="grid min-h-dvh place-items-center text-muted">
      <span className="animate-pulse">{t("loading")}</span>
    </div>
  );
}
