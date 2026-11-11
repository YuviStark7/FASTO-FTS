import "server-only";
import { getScoutData } from "@/lib/queries/scout";

export type { Category, CellRow, Territory } from "@/lib/queries/scout";

/** Matrix data: 15 categories x 20 pilot territories joined to their cells. Same RLS-scoped read as Scout. */
export async function getMatrixData() {
  return getScoutData();
}
