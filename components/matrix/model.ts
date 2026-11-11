import type { Category, CellRow, Territory } from "@/lib/queries/matrix";

export type ViewModel = {
  rows: { category: Category; withData: number; total: number; hasMatch: boolean }[];
  cols: Territory[];
  byKey: Map<string, CellRow>;
  matches: (c: CellRow | undefined) => boolean;
};

export const cellKey = (categoryId: number, territoryId: number) => `${categoryId}:${territoryId}`;

export const localName = (x: { name_it: string; name_en: string }, locale: string) =>
  locale === "en" ? x.name_en : x.name_it;
