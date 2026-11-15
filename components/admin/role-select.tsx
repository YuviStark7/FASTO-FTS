"use client";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { setUserRole } from "@/app/[locale]/(app)/admin/ops-actions";
import { ROLES, isLastAdminError, type AppRole } from "@/lib/admin-ops";

/** Role picker for one membership: choose, then confirm. The database decides; its refusal is shown as it came. */
export function RoleSelect({ userId, orgId, email, role }: { userId: string; orgId: string; email: string; role: AppRole }) {
  const t = useTranslations("admin.users");
  const tr = useTranslations("admin.roles");
  const [next, setNext] = useState<AppRole>(role);
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ text: string; detail?: string } | null>(null);
  const id = `role-${userId}-${orgId}`;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="t-label block">
        {t("changeRole")}
      </label>
      <select
        id={id}
        className="field sm:max-w-56"
        value={next}
        disabled={pending}
        aria-label={t("roleOf", { email })}
        onChange={(e) => {
          setNext(e.target.value as AppRole);
          setError(null);
        }}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {tr(r)}
          </option>
        ))}
      </select>
      {next !== role && (
        <div role="group" aria-label={t("changeRole")} className="space-y-3 rounded-[var(--radius-tile)] bg-surface-2 p-3">
          <p className="text-sm font-medium break-words">{t("confirm", { email, from: tr(role), to: tr(next) })}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await setUserRole(userId, orgId, next).catch(() => ({ ok: false, reason: "notAllowed" }) as const);
                  if (r.ok) return window.location.reload();
                  if (r.reason === "database") setError({ text: isLastAdminError(r.message) ? t("lastAdmin") : t("dbError"), detail: r.message });
                  else setError({ text: r.reason === "self" ? t("selfError") : t("error") });
                })
              }
            >
              {pending ? t("saving") : t("confirmButton")}
            </button>
            <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => setNext(role)}>
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
      {error && (
        <div role="alert" className="space-y-0.5 text-sm text-threatened">
          <p className="font-medium">{error.text}</p>
          {error.detail && <p className="num break-words">{t("dbMessage", { message: error.detail })}</p>}
        </div>
      )}
    </div>
  );
}
