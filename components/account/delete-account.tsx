"use client";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

/** Delete-account control: a second step asks the user to type their email; nothing is deleted before that. */
export function DeleteAccount({ email }: { email: string }) {
  const t = useTranslations("account.delete");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<"confirm_mismatch" | "last_admin" | "failed" | null>(null);
  const [pending, start] = useTransition();
  const matches = typed.trim().toLowerCase() === email.trim().toLowerCase();

  if (!open)
    return (
      <button type="button" className="btn btn-ghost h-11 w-full text-threatened" onClick={() => setOpen(true)} data-testid="delete-account-open">
        {t("open")}
      </button>
    );

  return (
    <form
      className="space-y-3"
      data-testid="delete-account-form"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const prefix = locale === "en" ? "/en" : "";
        start(async () => {
          try {
            const res = await fetch(`${prefix}/account/delete`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: typed }),
            });
            const r = (await res.json()) as { ok: boolean; reason?: "confirm_mismatch" | "last_admin" | "failed" };
            if (r.ok) window.location.assign(`${prefix}/login?deleted=1`);
            else setError(r.reason ?? "failed");
          } catch {
            setError("failed");
          }
        });
      }}
    >
      <p className="text-sm">{t("warning")}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
        <li>{t("deletes")}</li>
        <li>{t("keeps")}</li>
      </ul>
      <label className="block space-y-1 text-sm">
        <span>{t("typeEmail", { email })}</span>
        <input
          type="email"
          autoComplete="off"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="field h-11 w-full"
          aria-describedby={error ? "delete-account-error" : undefined}
        />
      </label>
      {error && (
        <p id="delete-account-error" role="alert" className="text-sm text-threatened">
          {t(`error.${error}`)}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" className="btn btn-quiet h-11 flex-1" onClick={() => (setOpen(false), setTyped(""), setError(null))} disabled={pending}>
          {t("cancel")}
        </button>
        <button type="submit" className="btn btn-ghost h-11 flex-1 text-threatened" disabled={!matches || pending} aria-busy={pending}>
          {pending ? t("pending") : t("confirm")}
        </button>
      </div>
    </form>
  );
}
