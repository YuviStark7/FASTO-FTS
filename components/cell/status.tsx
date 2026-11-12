import { CircleDashed, MoveRight, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Database } from "@/lib/database.types";
import { cn } from "@/lib/utils";

export type CellStatus = Database["public"]["Enums"]["cell_status"];

const META: Record<CellStatus, { Icon: typeof TrendingUp; text: string }> = {
  expanding: { Icon: TrendingUp, text: "text-expanding" },
  consolidated: { Icon: MoveRight, text: "text-consolidated" },
  threatened: { Icon: TrendingDown, text: "text-threatened" },
  insufficient_data: { Icon: CircleDashed, text: "text-muted" },
};

/** Status is never shown by colour alone: icon + word + colour. */
export function StatusLabel({ status, className }: { status: CellStatus; className?: string }) {
  const t = useTranslations("status");
  const { Icon, text } = META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", text, className)}>
      <Icon aria-hidden className="size-4" />
      {t(status)}
    </span>
  );
}

/** Text colour class of a status (icon colour; the word stays in the body colour). */
export const STATUS_TEXT: Record<CellStatus, string> = Object.fromEntries(
  Object.entries(META).map(([k, v]) => [k, v.text]),
) as Record<CellStatus, string>;

export function statusIcon(status: CellStatus) {
  return META[status].Icon;
}
