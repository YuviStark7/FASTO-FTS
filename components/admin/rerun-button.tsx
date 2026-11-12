"use client";
import { RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { rerunSource } from "@/app/[locale]/(app)/admin/actions";

export function RerunButton({ sourceId, name, busy }: { sourceId: number; name: string; busy: boolean }) {
  const t = useTranslations("admin.rerun");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const disabled = pending || busy;
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={disabled}
        aria-label={t("label", { source: name })}
        title={busy ? t("busy") : undefined}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const r = await rerunSource(sourceId);
            setMsg(r.ok ? t(r.mode) : t("error"));
          })
        }
        className="btn btn-primary"
      >
        <RotateCw aria-hidden className={`size-4 ${pending ? "animate-spin" : ""}`} />
        {pending ? t("sending") : t("button")}
      </button>
      <p role="status" className="t-meta min-h-5">
        {msg ?? (busy ? t("busy") : "")}
      </p>
    </div>
  );
}
