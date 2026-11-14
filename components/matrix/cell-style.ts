import type { CellStatus } from "@/components/cell/status";

/** Status colours come from tokens only. Insufficient data is the hatched pattern, never a pale fill. */
export const STATUS_ORDER: CellStatus[] = ["expanding", "consolidated", "threatened", "insufficient_data"];

export const STATUS_CLASS: Record<CellStatus, string> = {
  expanding: "bg-expanding/15 text-expanding border-expanding/40",
  consolidated: "bg-consolidated/15 text-consolidated border-consolidated/40",
  threatened: "bg-threatened/15 text-threatened border-threatened/40",
  insufficient_data: "hatched text-muted border-border-strong/60",
};

export type ColourMode = "status" | "mos" | "coverage";

/** In MOS mode a cell is coloured only when it has a score; null is hatched, never a low value. */
export function cellClass(status: CellStatus, mos: number | null, mode: ColourMode): string {
  // Coverage mode: neutral surface (the thin bar and the icons carry the information); unknown stays hatched.
  if (mode === "coverage") return status === "insufficient_data" ? STATUS_CLASS.insufficient_data : "bg-surface-2 text-text border-border";
  if (mode === "mos") return mos === null ? STATUS_CLASS.insufficient_data : "bg-brand/12 text-text border-brand/50";
  return STATUS_CLASS[status];
}
