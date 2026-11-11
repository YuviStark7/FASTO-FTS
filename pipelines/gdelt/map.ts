/** Parse a DOC 2.0 timeline response and aggregate it to calendar months. No value is filled in. */

export type Timeline = { timeline?: { series?: string; data?: { date: string; value: number }[] }[] };

export type MonthCount = { month: string; periodStart: string; periodEnd: string; value: number };

const dayOf = (date: string) => /^(\d{4})(\d{2})(\d{2})/.exec(date);

/**
 * Sum the raw article counts per month. A month is returned only when every day of it is present
 * in the response; otherwise it is listed in `incomplete` (no row, never a guessed total).
 * Explicit zeros are kept: they are GDELT's own answer.
 */
export function monthlyCounts(doc: Timeline, months: string[]): { counts: MonthCount[]; incomplete: string[] } {
  const data = doc.timeline?.[0]?.data ?? [];
  const sums = new Map<string, number>();
  const days = new Map<string, Set<string>>();
  for (const p of data) {
    const m = dayOf(p.date);
    if (!m || typeof p.value !== "number" || !Number.isFinite(p.value)) continue;
    const month = `${m[1]}-${m[2]}`;
    sums.set(month, (sums.get(month) ?? 0) + p.value);
    if (!days.has(month)) days.set(month, new Set());
    days.get(month)!.add(m[3]);
  }
  const counts: MonthCount[] = [];
  const incomplete: string[] = [];
  for (const month of months) {
    const [y, mo] = month.split("-").map(Number);
    const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    if ((days.get(month)?.size ?? 0) < last) {
      incomplete.push(month);
      continue;
    }
    counts.push({ month, periodStart: `${month}-01`, periodEnd: `${month}-${String(last).padStart(2, "0")}`, value: sums.get(month)! });
  }
  return { counts, incomplete };
}

export function monthsBetween(start: Date, end: Date) {
  const out: string[] = [];
  for (let d = new Date(start); d <= end; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
