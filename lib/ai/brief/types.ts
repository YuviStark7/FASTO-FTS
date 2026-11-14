/**
 * Brief contract (module 06). Client-safe: no server imports. The fact pack is built by code from
 * stored snapshots; the model only writes prose around facts it is handed, citing them by id.
 */
import { z } from "zod";

export type Grade = "A" | "B" | "C";

export const SECTION_KEYS = ["summary", "market", "territory", "consumers", "competition", "entry", "limits"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

/** One citable figure. `display` is the only form of the number the model may write. */
export type Fact = {
  id: string; // "F1", "F2", ...
  section: SectionKey;
  label: string;
  display: string;
  grade: Grade | null;
  period: string;
  method: string;
  source: string;
  observationIds: number[];
  snapshotRef: string | null; // "trend_snapshots:12"
};

/** Non-numeric context the model may use without citation (names, statuses, notes). */
export type FactPack = {
  locale: "it" | "en";
  category: string;
  territory: string;
  country: string;
  status: string;
  statusRule: string | null;
  missingInputs: string[];
  representativenessNote: string | null;
  isDemo: boolean;
  facts: Fact[];
};

export const BriefDraftSchema = z.object({
  sections: z.array(
    z.object({
      key: z.enum(SECTION_KEYS),
      heading: z.string(),
      sentences: z.array(z.object({ text: z.string(), facts: z.array(z.string()) })),
    }),
  ),
});
export type BriefDraft = z.infer<typeof BriefDraftSchema>;

/** What is stored in brief_versions.content. */
export type BriefContent = {
  sections: { key: SectionKey; heading: string; sentences: { text: string; facts: string[] }[] }[];
  facts: Fact[];
  /** Sentences removed by the citation check after the retry, with the reason. Never shipped. */
  dropped: { path: string; text: string; reason: string }[];
  context: Omit<FactPack, "facts" | "locale">;
};
