"use client";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { setSourceActive } from "@/app/[locale]/(app)/admin/actions";

export function ActiveToggle({ sourceId, name, active }: { sourceId: number; name: string; active: boolean }) {
  const t = useTranslations("admin");
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={t("toggle.label", { source: name })}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await setSourceActive(sourceId, !active);
            setFailed(!r.ok);
          })
        }
        className="group -ml-1 inline-flex min-h-11 items-center gap-2.5 rounded-full px-1 text-sm transition-opacity duration-(--dur-base) disabled:opacity-50"
      >
        <span aria-hidden className={`h-6 w-11 rounded-full p-0.5 transition-colors duration-(--dur-base) ${active ? "bg-brand" : "bg-border-strong"}`}>
          <span className={`block size-5 rounded-full bg-surface shadow-e1 transition-transform duration-(--dur-base) ease-spring group-active:scale-90 ${active ? "translate-x-5" : ""}`} />
        </span>
        {active ? t("sources.yes") : t("sources.no")}
      </button>
      {failed && (
        <p role="alert" className="text-sm text-threatened">
          {t("toggle.error")}
        </p>
      )}
    </div>
  );
}
