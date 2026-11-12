import { CheckCircle2, CircleAlert, Clock, Loader, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Database } from "@/lib/database.types";
import { cn } from "@/lib/utils";

export type RunStatus = Database["public"]["Enums"]["run_status"];

const META: Record<RunStatus, { Icon: typeof Clock; text: string; spin?: boolean }> = {
  queued: { Icon: Clock, text: "text-muted" },
  running: { Icon: Loader, text: "text-text", spin: true },
  succeeded: { Icon: CheckCircle2, text: "text-expanding" },
  partial: { Icon: CircleAlert, text: "text-consolidated" },
  failed: { Icon: XCircle, text: "text-threatened" },
};

/** Icon + word + colour, never colour alone. */
export function RunStatusLabel({ status }: { status: RunStatus }) {
  const t = useTranslations("admin.run");
  const { Icon, text, spin } = META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", text)}>
      <Icon aria-hidden className={cn("size-4", spin && "animate-spin")} />
      {t(status)}
    </span>
  );
}
