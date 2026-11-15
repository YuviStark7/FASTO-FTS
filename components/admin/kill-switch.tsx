"use client";
import { Power, PowerOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { setAiEnabled } from "@/app/[locale]/(app)/admin/ops-actions";

/** Reloads the document without the one-shot `saved` flag (a client refresh can stay suspended after an action). */
export function reloadClean() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("saved")) return window.location.reload();
  url.searchParams.delete("saved");
  window.location.replace(url);
}

/** Kill switch for all runtime AI (`ai.enabled`). State is icon + words, and a change needs a second, explicit step. */
export function KillSwitch({ enabled }: { enabled: boolean | null }) {
  const t = useTranslations("admin.usage.kill");
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);

  if (enabled === null) {
    return (
      <section role="alert" className="hatched rounded-[var(--radius-card)] border border-border-strong/60 p-4 font-medium sm:p-6" data-testid="kill-switch">
        {t("missing")}
      </section>
    );
  }
  const Icon = enabled ? Power : PowerOff;
  return (
    <section
      aria-labelledby="kill-title"
      data-testid="kill-switch"
      data-enabled={enabled}
      className={`card space-y-4 border-2 p-4 sm:p-6 ${enabled ? "border-border" : "border-threatened"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span aria-hidden className={`grid size-11 shrink-0 place-items-center rounded-[var(--radius-tile)] bg-surface-2 ${enabled ? "text-expanding" : "text-threatened"}`}>
            <Icon strokeWidth={1.75} className="size-5" />
          </span>
          <div>
            <h2 id="kill-title" className="t-label">
              {t("title")}
            </h2>
            <p className="t-h2" data-testid="ai-state">
              {enabled ? t("on") : t("off")}
            </p>
          </div>
        </div>
        {!confirming && (
          <button type="button" className={`btn ${enabled ? "btn-ghost" : "btn-primary"}`} onClick={() => setConfirming(true)}>
            {enabled ? t("suspend") : t("resume")}
          </button>
        )}
      </div>
      <p className="text-sm leading-relaxed text-muted">{enabled ? t("onHint") : t("offHint")}</p>
      {confirming && (
        <div role="group" aria-label={enabled ? t("suspend") : t("resume")} className="space-y-3 rounded-[var(--radius-tile)] bg-surface-2 p-4">
          <p className="font-medium">{enabled ? t("confirmSuspend") : t("confirmResume")}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setFailed(false);
                  const r = await setAiEnabled(!enabled).catch(() => ({ ok: false }));
                  if (r.ok) reloadClean();
                  else setFailed(true);
                })
              }
            >
              {pending ? t("saving") : enabled ? t("confirmSuspendButton") : t("confirmResumeButton")}
            </button>
            <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => setConfirming(false)}>
              {t("cancel")}
            </button>
          </div>
          {failed && (
            <p role="alert" className="text-sm text-threatened">
              {t("error")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
