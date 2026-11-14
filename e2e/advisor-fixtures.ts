import { admin } from "./helpers";

/**
 * Fixtures for the Briefs and Ask flows. Values are test placeholders, never market data: the
 * brief context is flagged `isDemo`, so every screen and export shows the DEMO mark.
 * Each test owns one cell (briefs are unique per category and territory) and deletes its rows.
 */
export const fact = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  section: "market",
  label: "Crescita annua del valore reale (CAGR)",
  display: "+1,1%",
  grade: "A",
  period: "2019–2024",
  method: "trend-v1",
  source: "Eurostat",
  observationIds: [],
  snapshotRef: "trend_snapshots:1",
  ...over,
});

export const FACTS = [
  fact("F1"),
  fact("F2", { section: "territory", label: "Domanda locale stimata (intervallo)", display: "11 Mln € (9 Mln € – 13 Mln €)", grade: "B", method: "geo-v1", source: "Stima del modello geo-v1", snapshotRef: "geo_estimates:1" }),
  fact("F3", { section: "consumers", label: "Indice di sentiment dei consumatori (CSI, 0–100)", display: "61", grade: "C", period: "2026-01-01 – 2026-06-30", method: "csi-v1", source: "Bluesky", snapshotRef: "csi_snapshots:1" }),
  fact("F4", { label: "Fatto mai citato", display: "77" }),
];

export function briefContent(tag: string, dropped = 2) {
  return {
    sections: [
      { key: "summary", heading: "Sintesi", sentences: [{ text: `Brief di prova ${tag}: il valore reale cresce del +1,1% l'anno.`, facts: ["F1"] }, { text: "La cella è in espansione.", facts: [] }] },
      { key: "territory", heading: "Territorio", sentences: [{ text: "La domanda locale stimata è di 11 Mln € (9 Mln € – 13 Mln €).", facts: ["F2"] }] },
      { key: "consumers", heading: "Consumatori", sentences: [{ text: "Il sentiment online vale 61 su 100, come segnale esplorativo.", facts: ["F3"] }] },
    ],
    facts: FACTS,
    dropped: Array.from({ length: dropped }, (_, i) => ({ path: `sections.0.sentences.${i + 2}`, text: `Frase scartata ${i + 1} con 99%.`, reason: "number not in cited facts" })),
    context: {
      category: "Aceti e condimenti",
      territory: tag,
      country: "Italia",
      status: "expanding",
      statusRule: "Valore reale e volumi in crescita nel periodo.",
      missingInputs: ["competition"],
      representativenessNote: "Menzioni online in italiano: non sono un campione rappresentativo.",
      isDemo: true,
    },
  };
}

export async function ids(categorySlug: string, territorySlug: string) {
  const [{ data: cat }, { data: ter }] = await Promise.all([
    admin.from("categories").select("id").eq("slug", categorySlug).single(),
    admin.from("territories").select("id").eq("slug", territorySlug).single(),
  ]);
  return { categoryId: cat!.id, territoryId: ter!.id };
}

/** Inserts a brief with the given versions (oldest first); `current` indexes the current one. */
export async function insertBrief(o: { category: string; territory: string; status: "draft" | "reviewed" | "published"; versions: { passed: boolean; dropped?: number }[]; current: number }) {
  const { categoryId, territoryId } = await ids(o.category, o.territory);
  await admin.from("briefs").delete().eq("category_id", categoryId).eq("territory_id", territoryId); // leftovers of an aborted run
  const { data: b, error } = await admin.from("briefs").insert({ category_id: categoryId, territory_id: territoryId }).select("id").single();
  if (error) throw error;
  const versionIds: number[] = [];
  for (const [i, v] of o.versions.entries()) {
    const { data, error: e } = await admin
      .from("brief_versions")
      .insert({ brief_id: b.id, version: i + 1, locale: "it", content: briefContent(`${o.territory} v${i + 1}`, v.dropped ?? 2), model: "test-model", prompt_version: "brief.v1", citation_check_passed: v.passed })
      .select("id")
      .single();
    if (e) throw e;
    versionIds.push(data.id);
  }
  const { error: ue } = await admin.from("briefs").update({ current_version_id: versionIds[o.current], status: o.status }).eq("id", b.id);
  if (ue) throw ue;
  return { briefId: b.id, versionIds };
}

export async function deleteBrief(briefId: number) {
  await admin.from("briefs").update({ current_version_id: null, status: "draft" }).eq("id", briefId);
  await admin.from("briefs").delete().eq("id", briefId);
}

/** A stored, checked chat turn in the shape `askAction` writes to `messages.content`. */
export const storedTurn = {
  ok: true,
  answer: {
    sentences: [
      { text: "A Roma il valore reale dei formaggi cresce del +1,1% l'anno.", facts: ["T1"] },
      { text: "Il sentiment online vale 61 su 100.", facts: ["T2"] },
    ],
    follow_ups: ["E a Milano?", "Quali fonti stanno dietro a questi dati?"],
  },
  facts: [fact("T1"), fact("T2", { section: "consumers", label: "Indice di sentiment dei consumatori (CSI, 0–100)", display: "61", grade: "C", method: "csi-v1", source: "Bluesky", snapshotRef: "csi_snapshots:1" })],
  checked: "passed",
  toolCalls: [{ name: "get_cell", input: { category: "cheese", territory: "roma" } }],
};

export const unavailableTurn = {
  ok: true,
  answer: { sentences: [{ text: "Non posso rispondere con dati verificati a questa domanda. Prova a chiedere di una categoria in una delle città pilota.", facts: [] }], follow_ups: [] },
  facts: [],
  checked: "unavailable",
  toolCalls: [],
};

export async function insertConversation(userId: string, turns: { question: string; turn: unknown }[]) {
  const { data: m } = await admin.from("memberships").select("org_id").eq("user_id", userId).limit(1).single();
  const { data: c, error } = await admin.from("conversations").insert({ org_id: m!.org_id, user_id: userId, title: turns[0].question, locale: "it" }).select("id").single();
  if (error) throw error;
  for (const t of turns) {
    const { error: e } = await admin.from("messages").insert([
      { conversation_id: c.id, org_id: m!.org_id, role: "user", content: { text: t.question } },
      { conversation_id: c.id, org_id: m!.org_id, role: "assistant", content: t.turn as never },
    ]);
    if (e) throw e;
  }
  return { conversationId: c.id, orgId: m!.org_id as string };
}
