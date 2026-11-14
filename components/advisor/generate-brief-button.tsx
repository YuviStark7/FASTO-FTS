"use client";
import { RefreshCw, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { generateBriefAction } from "@/app/[locale]/(app)/brief-actions";
import { getPathname } from "@/lib/i18n/navigation";

type Reason = "not_staff" | "no_cell" | "no_facts" | "disabled" | "global_limit" | "user_limit" | "model_failed" | "network";

/**
 * Generates a new version of a cell's brief and opens it. Staff only: mount it behind a role check
 * (or use `StaffGenerateBrief`); the server action refuses everyone else regardless.
 * Generation takes 20 to 60 seconds, so the pending state says so.
 * The route that mounts it should export `maxDuration` (120 or more) for the server action.
 */
export function GenerateBriefButton({ category, territory, locale, refresh = false, className }: { category: string; territory: string; locale: "it" | "en"; refresh?: boolean; className?: string }) {
  const t = useTranslations("briefs.generate");
  const uiLocale = useLocale();
  const [pending, start] = useTransition();
  const [error, setError] = useState<Reason | null>(null);
  const Icon = refresh ? RefreshCw : Sparkles;

  return (
    <div className={className} data-testid="generate-brief">
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            try {
              const r = await generateBriefAction(category, territory, locale);
              // Document navigation: the new version must be read fresh from the server.
              if (r.ok) window.location.assign(`${getPathname({ href: `/briefs/${r.briefId}`, locale: uiLocale })}?v=${r.versionId}`);
              else setError(r.reason);
            } catch {
              setError("network");
            }
          });
        }}
        className="btn btn-primary"
      >
        <Icon aria-hidden className={`size-4 ${pending ? "animate-spin motion-reduce:animate-none" : ""}`} />
        {pending ? t("pending") : refresh ? t("refresh") : t("button")}
      </button>
      <p role="status" className="t-meta mt-1.5 min-h-5">
        {pending && t("pendingHint")}
        {!pending && error && <span role="alert" className="text-text" data-testid="generate-error">{t(`errors.${error}`)}</span>}
      </p>
    </div>
  );
}
