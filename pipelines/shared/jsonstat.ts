/** Minimal JSON-stat 2.0 reader for Eurostat's dissemination API. */
export type JsonStat = {
  id: string[];
  size: number[];
  value: Record<string, number> | number[];
  status?: Record<string, string>;
  dimension: Record<string, { label?: string; category: { index: Record<string, number>; label?: Record<string, string> } }>;
  updated?: string;
  label?: string;
};

export type JsonStatRow = Record<string, string> & { _value: string };

/** One row per non-missing value; dimension codes as string fields, value in `value`. */
export function readJsonStat(doc: JsonStat): { rows: (Record<string, string> & { value: number; flag?: string })[]; labels: Record<string, Record<string, string>> } {
  const codeAt = doc.id.map((dim) => {
    const idx = doc.dimension[dim].category.index;
    const arr: string[] = [];
    for (const [code, pos] of Object.entries(idx)) arr[pos] = code;
    return arr;
  });
  const rows: (Record<string, string> & { value: number; flag?: string })[] = [];
  const entries: [number, number][] = Array.isArray(doc.value)
    ? doc.value.map((v, i) => [i, v] as [number, number]).filter(([, v]) => v !== null)
    : Object.entries(doc.value).map(([k, v]) => [Number(k), v]);
  for (const [flat, value] of entries) {
    let rest = flat;
    const rec: Record<string, string> = {};
    for (let d = doc.id.length - 1; d >= 0; d--) {
      const size = doc.size[d];
      rec[doc.id[d]] = codeAt[d][rest % size];
      rest = Math.floor(rest / size);
    }
    const flag = doc.status?.[String(flat)];
    rows.push(Object.assign(rec, { value }, flag ? { flag } : {}));
  }
  const labels = Object.fromEntries(doc.id.map((d) => [d, doc.dimension[d].category.label ?? {}]));
  return { rows, labels };
}
