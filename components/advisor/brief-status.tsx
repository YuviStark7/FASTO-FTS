import { BadgeCheck, Eye, PencilLine } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Database } from "@/lib/database.types";
import { cn } from "@/lib/utils";

type BriefStatus = Database["public"]["Enums"]["brief_status"];

const META: Record<BriefStatus, { Icon: typeof Eye; text: string }> = {
  draft: { Icon: PencilLine, text: "text-muted" },
  reviewed: { Icon: Eye, text: "text-consolidated" },
  published: { Icon: BadgeCheck, text: "text-expanding" },
};

/** Review status of a brief: icon + word, never colour alone. */
export function BriefStatusLabel({ status, className }: { status: BriefStatus; className?: string }) {
  const t = useTranslations("briefs.status");
  const { Icon, text } = META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", className)} data-testid="brief-status">
      <Icon aria-hidden className={cn("size-4", text)} />
      {t(status)}
    </span>
  );
}
