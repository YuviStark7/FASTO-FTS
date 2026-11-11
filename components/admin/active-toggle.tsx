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
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface-2 px-4 text-sm disabled:opacity-50"
      >
        <span aria-hidden className={`h-5 w-9 rounded-full p-0.5 ${active ? "bg-brand" : "bg-border"}`}>
          <span className={`block size-4 rounded-full bg-bg transition-transform ${active ? "translate-x-4" : ""}`} />
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
