import { useTranslations } from "next-intl";
import { CircleDashed } from "lucide-react";
import type { CellRow } from "@/lib/queries/matrix";
import { GradeBadge } from "@/components/cell/grade-badge";

/** Words for a cell's MOS: value, partial label and grade, or that there is none. */
export function useMosLabel() {
  const t = useTranslations("matrix");
  return (cell: CellRow) =>
    cell.mos == null || !cell.mos_grade
      ? t("mosCellMissing")
      : t(cell.mos_is_partial ? "mosCellPartial" : "mosCell", { value: Math.round(Number(cell.mos)), grade: cell.mos_grade });
}

/** MOS colour mode: the score with its grade beside it and the partial label. No score is hatched by the cell, never 0. */
export function MosCell({ cell }: { cell: CellRow }) {
  const t = useTranslations("matrix");
  if (cell.mos == null || !cell.mos_grade) return <CircleDashed aria-hidden className="size-4" />;
  return (
    <span aria-hidden className="flex flex-col items-center gap-0.5">
      <span className="flex items-center gap-1">
        <span className="num text-[13px] leading-none font-medium">{Math.round(Number(cell.mos))}</span>
        <GradeBadge grade={cell.mos_grade} />
      </span>
      {cell.mos_is_partial && <span className="text-[10px] leading-none">{t("mosPartial")}</span>}
    </span>
  );
}
