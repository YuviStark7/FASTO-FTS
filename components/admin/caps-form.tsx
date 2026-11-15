"use client";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { saveCaps, type SaveCapsResult } from "@/app/[locale]/(app)/admin/ops-actions";
import { CAP_FIELDS, type CapError, type CapField } from "@/lib/admin-ops";

/** Caps editor. The browser does not validate (`noValidate`): the server action is the only judge of the ranges. */
export function CapsForm({ values, saved }: { values: Record<CapField, number | null>; saved: boolean }) {
  const t = useTranslations("admin.usage.caps");
  const [form, setForm] = useState(() => Object.fromEntries(CAP_FIELDS.map((c) => [c.field, values[c.field] === null ? "" : String(values[c.field])])) as Record<CapField, string>);
  const [errors, setErrors] = useState<Partial<Record<CapField, CapError>>>({});
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setFailed(false);
          const r = await saveCaps(form).catch((): SaveCapsResult => ({ ok: false }));
          if (r.ok) {
            // Full document load with a one-shot flag: the limits above are re-read from the database.
            const url = new URL(window.location.href);
            if (url.searchParams.get("saved") === "1") return window.location.reload();
            url.searchParams.set("saved", "1");
            return window.location.assign(url);
          }
          setErrors(r.errors ?? {});
          setFailed(!r.errors);
        });
      }}
    >
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {CAP_FIELDS.map(({ field, min, max, integer }) => {
          const error = errors[field];
          return (
            <div key={field} className="space-y-1.5">
              <label htmlFor={`cap-${field}`} className="block text-sm font-medium">
                {t(`fields.${field}`)}
              </label>
              <input
                id={`cap-${field}`}
                name={field}
                type="number"
                inputMode={integer ? "numeric" : "decimal"}
                step={integer ? 1 : "any"}
                className="field num"
                value={form[field]}
                aria-invalid={error ? true : undefined}
                aria-describedby={`cap-${field}-hint`}
                onChange={(e) => {
                  setForm((f) => ({ ...f, [field]: e.target.value }));
                  setErrors((x) => ({ ...x, [field]: undefined }));
                }}
              />
              <p id={`cap-${field}-hint`} className={`text-sm ${error ? "font-medium text-threatened" : "text-muted"}`} role={error ? "alert" : undefined}>
                {error ? t(`errors.${error}`, { min, max }) : t("range", { min, max })}
              </p>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </button>
        {failed && (
          <p role="alert" className="text-sm text-threatened">
            {t("error")}
          </p>
        )}
        {saved && !failed && !pending && Object.values(errors).every((e) => !e) && (
          <p role="status" className="text-sm font-medium text-expanding" data-testid="caps-saved">
            {t("saved")}
          </p>
        )}
      </div>
    </form>
  );
}
