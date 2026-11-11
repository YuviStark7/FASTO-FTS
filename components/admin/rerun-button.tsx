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
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-medium text-brand-contrast disabled:opacity-50"
      >
        <RotateCw aria-hidden className={`size-4 ${pending ? "animate-spin" : ""}`} />
        {pending ? t("sending") : t("button")}
      </button>
      <p role="status" className="text-sm text-muted">
        {msg ?? (busy ? t("busy") : "")}
      </p>
    </div>
  );
}
