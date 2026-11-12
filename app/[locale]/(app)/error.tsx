"use client";
import { useTranslations } from "next-intl";

export default function ErrorState({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("common");
  return (
    <div role="alert" className="grid min-h-[70dvh] place-items-center px-4 text-center">
      <div className="max-w-md space-y-6">
        <p className="t-h1">{t("error")}</p>
        <button onClick={reset} className="btn btn-primary">
          {t("retry")}
        </button>
      </div>
    </div>
  );
}
