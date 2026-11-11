"use client";
import { useLocale, useTranslations } from "next-intl";
import type { CellSheet } from "@/lib/queries/cell";
import { GradeBadge } from "@/components/cell/grade-badge";
import { FigureValue } from "./figure-value";
import { formatDate } from "./format";
import { Panel } from "./ui";

type Offer = CellSheet["competition"]["offers"][number];

export function CompetitionTab({ competition }: { competition: CellSheet["competition"] }) {
  const t = useTranslations("sheet.competition");
  const locale = useLocale();
  const money = (v: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(v);
  const priced = competition.offers.filter((o) => o.price != null);

  // Group by pack size for the ladder: min and max of observed prices, as read from offers (display grouping only).
  const ladder = new Map<string, Offer[]>();
  for (const o of priced) {
    if (o.packSize == null) continue;
    const k = `${o.packSize} ${o.packUnit ?? ""}`.trim();
    ladder.set(k, [...(ladder.get(k) ?? []), o]);
  }

  return (
    <div className="space-y-4">
      <Panel title={t("assortment")}>
        <p className="mb-3 text-sm text-muted">{t("assortmentNote")}</p>
        {competition.assortment.length === 0 ? (
          <p className="text-sm">{t("assortmentEmpty")}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {competition.assortment.map((a) => (
              <li key={a.tag} className="flex items-center justify-between gap-3">
                <span className="text-sm break-all">{a.tag}</span>
                <FigureValue figure={a.figure} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={t("offers")}>
        {priced.length === 0 ? (
          <p className="hatched rounded-lg border border-border p-3 text-sm">{t("offersEmpty")}</p>
        ) : (
          <div className="space-y-5">
            {ladder.size > 0 && (
              <div>
                <h4 className="mb-1 text-sm font-medium">{t("ladder")}</h4>
                <ul className="num space-y-1 text-sm">
                  {[...ladder.entries()].map(([pack, os]) => {
                    const ps = os.map((o) => o.price!);
                    return (
                      <li key={pack}>
                        {pack}: {t("min")} {money(Math.min(...ps))}, {t("max")} {money(Math.max(...ps))} ({t("offerCount", { count: os.length })})
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">{t("offers")}</caption>
                <thead className="text-muted">
                  <tr>
                    <th scope="col" className="py-1 pr-3">{t("product")}</th>
                    <th scope="col" className="py-1 pr-3">{t("competitor")}</th>
                    <th scope="col" className="py-1 pr-3">{t("pack")}</th>
                    <th scope="col" className="py-1 pr-3">{t("price")}</th>
                    <th scope="col" className="py-1 pr-3">{t("channel")}</th>
                    <th scope="col" className="py-1">{t("observed")}</th>
                  </tr>
                </thead>
                <tbody className="num">
                  {competition.offers.map((o, i) => (
                    <tr key={i} className="border-t border-border align-top">
                      <td className="py-1 pr-3">{o.productName}</td>
                      <td className="py-1 pr-3">{o.competitor ?? "-"}</td>
                      <td className="py-1 pr-3">{o.packSize != null ? `${o.packSize} ${o.packUnit ?? ""}` : "-"}</td>
                      <td className="py-1 pr-3 whitespace-nowrap">
                        {o.price != null ? (
                          <span className="inline-flex items-center gap-1.5">
                            {money(o.price)} <GradeBadge grade={o.grade} />
                          </span>
                        ) : (
                          t("noPrice")
                        )}
                      </td>
                      <td className="py-1 pr-3">{o.channel ?? "-"}</td>
                      <td className="py-1">{formatDate(o.observedOn, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
