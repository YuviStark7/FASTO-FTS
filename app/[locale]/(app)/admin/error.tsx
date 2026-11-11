"use client";
import { useTranslations } from "next-intl";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("common");
  return (
    <div role="alert" className="grid min-h-[60dvh] place-items-center px-4 text-center">
      <div className="space-y-4">
        <p className="text-2xl font-light">{t("error")}</p>
        <button onClick={reset} className="h-11 rounded-full bg-brand px-6 text-brand-contrast">
          {t("retry")}
        </button>
      </div>
    </div>
  );
}
