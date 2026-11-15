import { ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";

/** `adminOnly`: the page is for admins, so an analyst is told that rather than "analysts and admins". */
export function NotAllowed({ adminOnly = false }: { adminOnly?: boolean }) {
  const t = useTranslations("admin.notAllowed");
  return (
    <div role="alert" className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div aria-hidden className="grid h-28 w-20 place-items-center rounded-[var(--radius-card)] border border-border bg-surface-2 shadow-e2">
        <ShieldAlert strokeWidth={1.5} className="size-8 text-muted" />
      </div>
      <h1 className="t-h1">{t("title")}</h1>
      <p className="t-lead">{adminOnly ? t("adminBody") : t("body")}</p>
    </div>
  );
}
