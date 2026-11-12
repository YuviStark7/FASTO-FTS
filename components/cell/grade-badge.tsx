import { useTranslations } from "next-intl";
import type { Database } from "@/lib/database.types";

export type Grade = Database["public"]["Enums"]["grade"];

/** A solid, B outlined, C dotted. Shown beside every figure. */
export function GradeBadge({ grade }: { grade: Grade }) {
  const t = useTranslations("grade");
  return (
    <abbr title={t(grade)} className={`grade grade-${grade} no-underline`}>
      {grade}
    </abbr>
  );
}

export function DemoBadge() {
  const t = useTranslations("common");
  return (
    <span className="demo">{t("demo")}</span>
  );
}
