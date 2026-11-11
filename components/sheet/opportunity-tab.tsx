"use client";
import { useTranslations } from "next-intl";
import { InsufficientState } from "./ui";

/** Placeholder until Day 4: no numbers, no MOS. */
export function OpportunityTab() {
  const t = useTranslations("sheet.opportunity");
  return (
    <InsufficientState title={t("title")}>
      <p>{t("body")}</p>
      <p className="font-medium">{t("badge")}</p>
    </InsufficientState>
  );
}
