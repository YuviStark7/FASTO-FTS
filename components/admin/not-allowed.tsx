import { ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";

export function NotAllowed() {
  const t = useTranslations("admin.notAllowed");
  return (
    <div role="alert" className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div aria-hidden className="hatched grid h-28 w-20 place-items-center rounded-[var(--radius-card)]">
        <ShieldAlert className="size-8 text-muted" />
      </div>
      <h1 className="text-3xl font-light tracking-tight">{t("title")}</h1>
      <p className="text-muted">{t("body")}</p>
    </div>
  );
}
