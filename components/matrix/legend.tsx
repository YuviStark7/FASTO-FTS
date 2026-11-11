import { useTranslations } from "next-intl";
import { CircleDashed, Unplug } from "lucide-react";
import { statusIcon } from "@/components/cell/status";
import { cn } from "@/lib/utils";
import { STATUS_CLASS, STATUS_ORDER, type ColourMode } from "./cell-style";

/** Legend: swatch + icon + word for every status, so colour is never the only signal. */
export function MatrixLegend({ mode, mosMissing }: { mode: ColourMode; mosMissing: boolean }) {
  const t = useTranslations("matrix");
  const s = useTranslations("status");
  return (
    <ul aria-label={t("legend")} className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
      {mode === "coverage" ? (
        <>
          <li className="flex items-center gap-2">
            <span aria-hidden className="h-1 w-8 overflow-hidden rounded-full bg-surface-2">
              <span className="block h-full w-1/2 rounded-full bg-brand" />
            </span>
            {t("coverageLegendBar")}
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="grid size-6 place-items-center rounded-md border border-border bg-surface-2">
              <Unplug className="size-4" />
            </span>
            {t("coverageLegendMissing")}
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="hatched grid size-6 place-items-center rounded-md border border-border">
              <CircleDashed className="size-4 text-muted" />
            </span>
            {s("insufficient_data")}
          </li>
        </>
      ) : mode === "mos" && mosMissing ? (
        <li className="flex items-center gap-2">
          <span aria-hidden className="hatched grid size-6 place-items-center rounded-md border border-border">
            <CircleDashed className="size-4 text-muted" />
          </span>
          {t("mosLegend")}
        </li>
      ) : (
        STATUS_ORDER.map((st) => {
          const Icon = statusIcon(st);
          return (
            <li key={st} className="flex items-center gap-2">
              <span aria-hidden className={cn("grid size-6 place-items-center rounded-md border", STATUS_CLASS[st])}>
                <Icon className="size-4" />
              </span>
              {s(st)}
            </li>
          );
        })
      )}
    </ul>
  );
}
