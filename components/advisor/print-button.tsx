"use client";
import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { recordPdfExport } from "@/app/[locale]/(app)/briefs/actions";

/** Records the export, then opens the browser's print dialog (Save as PDF). */
export function PrintButton({ briefId, versionId }: { briefId: number; versionId: number }) {
  const t = useTranslations("briefs.export");
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setFailed(false);
            const r = await recordPdfExport(briefId, versionId).catch(() => ({ ok: false }));
            if (r.ok) window.print();
            else setFailed(true);
          })
        }
        className="btn btn-primary"
      >
        <Printer aria-hidden className="size-4" />
        {t("print")}
      </button>
      {failed && <p role="alert" className="text-sm">{t("recordFailed")}</p>}
    </div>
  );
}
