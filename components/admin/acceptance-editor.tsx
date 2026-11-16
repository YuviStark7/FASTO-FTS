"use client";
import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { saveManualValue, type SaveManualResult } from "@/app/[locale]/(app)/admin/acceptance/actions";
import { MANUAL_NOTE_MAX, MANUAL_VALUE_MAX, type ManualField } from "@/lib/acceptance";

/**
 * Inline editor for a hand-recorded target (admins only; the server action and RLS decide).
 * The browser does not validate (`noValidate`): the server action is the only judge.
 */
export function AcceptanceEditor({ slug, label, value, note }: { slug: string; label: string; value: number | null; note: string | null }) {
  const t = useTranslations("admin.acceptance.editor");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ value: value === null ? "" : String(value), note: note ?? "" });
  const [errors, setErrors] = useState<Partial<Record<ManualField, true>>>({});
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost" aria-label={t("openLabel", { target: label })} onClick={() => setOpen(true)}>
        <Pencil aria-hidden className="size-4" />
        {t("open")}
      </button>
    );
  }

  const id = `acc-${slug}`;
  return (
    <form
      noValidate
      aria-label={t("openLabel", { target: label })}
      className="space-y-4 rounded-[var(--radius-tile)] border border-border bg-surface-2 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setFailed(false);
          const r = await saveManualValue(slug, form).catch((): SaveManualResult => ({ ok: false }));
          // Full document load: the row and the summary are re-read from the database.
          if (r.ok) return window.location.reload();
          setErrors(r.errors ?? {});
          setFailed(!r.errors);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <div className="space-y-1.5">
          <label htmlFor={`${id}-value`} className="block text-sm font-medium">
            {t("value")}
          </label>
          <input
            id={`${id}-value`}
            name="value"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            className="field num"
            value={form.value}
            aria-invalid={errors.value ? true : undefined}
            aria-describedby={`${id}-value-hint`}
            onChange={(e) => {
              setForm((f) => ({ ...f, value: e.target.value }));
              setErrors((x) => ({ ...x, value: undefined }));
            }}
          />
          <p id={`${id}-value-hint`} className={`text-sm ${errors.value ? "font-medium text-threatened" : "text-muted"}`} role={errors.value ? "alert" : undefined}>
            {errors.value ? t("valueError", { max: MANUAL_VALUE_MAX }) : t("valueHint")}
          </p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-note`} className="block text-sm font-medium">
            {t("note")}
          </label>
          <textarea
            id={`${id}-note`}
            name="note"
            rows={2}
            className="field"
            value={form.note}
            aria-invalid={errors.note ? true : undefined}
            aria-describedby={`${id}-note-hint`}
            onChange={(e) => {
              setForm((f) => ({ ...f, note: e.target.value }));
              setErrors((x) => ({ ...x, note: undefined }));
            }}
          />
          <p id={`${id}-note-hint`} className={`num text-sm ${errors.note ? "font-medium text-threatened" : "text-muted"}`} role={errors.note ? "alert" : undefined}>
            {errors.note ? t("noteError", { max: MANUAL_NOTE_MAX }) : t("noteHint", { n: form.note.trim().length, max: MANUAL_NOTE_MAX })}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </button>
        <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => setOpen(false)}>
          {t("cancel")}
        </button>
        {failed && (
          <p role="alert" className="text-sm font-medium text-threatened">
            {t("error")}
          </p>
        )}
      </div>
      <p className="text-sm text-muted">{t("audited")}</p>
    </form>
  );
}
