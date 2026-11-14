/** Display formatting only. The sheet never computes a figure: it formats what the contract hands over. */
export function formatValue(value: number, unit: string, locale: string): string {
  switch (unit) {
    case "ratio_per_year":
      return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" }).format(value);
    case "EUR":
      return Math.abs(value) >= 10_000
        ? new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1 }).format(value)
        : new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
    case "EUR_per_capita":
      return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
    case "share":
      return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(value);
    case "count":
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
    case "points_0_100":
      return new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
    case "per_mention":
      return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    case "index_0_100":
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
    default:
      return new Intl.NumberFormat(locale, { maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 1 }).format(value);
  }
}

export function formatDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(d);
}
