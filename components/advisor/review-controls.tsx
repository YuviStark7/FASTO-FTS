"use client";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { setBriefStatus, type BriefStatus } from "@/app/[locale]/(app)/brief-actions";
import { cn } from "@/lib/utils";

export type ReviewAction = {
  key: "markReviewed" | "backToDraft" | "publish" | "unpublish" | "publishVersion";
  status: BriefStatus;
  versionId?: number;
  primary?: boolean;
  /** Shown instead of running the action (e.g. the version failed the citation check). */
  blocked?: "citation";
};

type Refusal = "citation" | "adminOnly" | "notAllowed" | "versionNotFound" | "generic";

/** Maps what the action or the database said to a message we can translate. */
function refusal(error: string | undefined): Refusal {
  if (!error) return "generic";
  if (error === "not_allowed") return "notAllowed";
  if (error === "version_not_found") return "versionNotFound";
  if (/citation check/i.test(error)) return "citation";
  if (/only admins/i.test(error)) return "adminOnly";
  return "generic";
}

/** Review workflow buttons. The server decides which actions exist; RLS and the trigger decide if they succeed. */
export function ReviewControls({ briefId, actions, className }: { briefId: number; actions: ReviewAction[]; className?: string }) {
  const t = useTranslations("briefs.review");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: true } | { ok: false; kind: Refusal; detail?: string } | null>(null);
  if (!actions.length) return null;

  function run(a: ReviewAction) {
    setResult(null);
    start(async () => {
      try {
        const r = await setBriefStatus(briefId, a.status, a.versionId);
        if (r.ok) {
          setResult({ ok: true });
          // A document reload, not router.refresh(): in this app a refresh that follows a server
          // action intermittently never commits, and a stale status on a review screen is worse
          // than a full reload.
          window.location.reload();
        } else {
          const kind = refusal(r.error);
          setResult({ ok: false, kind, detail: kind === "generic" ? r.error : undefined });
        }
      } catch {
        setResult({ ok: false, kind: "generic" });
      }
    });
  }

  return (
    <div className={className} data-testid="review-controls">
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={`${a.key}-${a.versionId ?? "current"}`}
            type="button"
            disabled={pending || a.blocked != null}
            title={a.blocked ? t(`errors.${a.blocked}`) : undefined}
            onClick={() => run(a)}
            className={cn("btn px-4", a.primary ? "btn-primary" : "btn-ghost")}
          >
            {t(a.key)}
          </button>
        ))}
      </div>
      {actions.some((a) => a.blocked) && <p className="mt-2 text-xs text-muted">{t("errors.citation")}</p>}
      <p role="status" className={cn("text-sm", (pending || result) && "mt-2")}>
        {pending && <span className="text-muted">{t("pending")}</span>}
        {!pending && result?.ok && t("done")}
        {!pending && result && !result.ok && (
          <span role="alert" data-testid="review-error">
            {t(`errors.${result.kind}`)}
            {result.detail && <span className="mt-0.5 block text-xs text-muted">{result.detail}</span>}
          </span>
        )}
      </p>
    </div>
  );
}
