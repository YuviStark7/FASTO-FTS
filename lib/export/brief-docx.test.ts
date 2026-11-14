import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import type { BriefContent, Fact } from "@/lib/ai/brief/types";
import { briefToDocx, factReference, type BriefDocMeta } from "./brief-docx";

/** Minimal zip reader (central directory + deflate), enough to open word/document.xml. */
function unzip(buf: Buffer, name: string): string {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let p = buf.readUInt32LE(eocd + 16);
  const n = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < n; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    if (buf.toString("utf8", p + 46, p + 46 + nameLen) === name) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      return (method === 0 ? data : inflateRawSync(data)).toString("utf8");
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${name} not in archive`);
}

const text = (xml: string) =>
  [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1])
    .join("")
    .replace(/&amp;/g, "&");

// Fixture values are placeholders for the test, not market data.
const fact = (id: string, over: Partial<Fact> = {}): Fact => ({
  id,
  section: "market",
  label: `Label ${id}`,
  display: `value-${id}`,
  grade: "A",
  period: "2019-2024",
  method: "trend-v1",
  source: "Eurostat",
  observationIds: [],
  snapshotRef: "trend_snapshots:1",
  ...over,
});

const content: BriefContent = {
  sections: [
    { key: "summary", heading: "Sintesi", sentences: [{ text: "Prima frase.", facts: ["F1"] }, { text: "Seconda frase senza cifre.", facts: [] }] },
    { key: "territory", heading: "Territorio", sentences: [{ text: "Terza frase.", facts: ["F2", "F4"] }] },
    { key: "limits", heading: "Limiti", sentences: [] },
  ],
  facts: [
    fact("F1"),
    fact("F2", { grade: "B", section: "territory", method: "geo-v1", snapshotRef: "geo_estimates:7", observationIds: [11, 12] }),
    fact("F3", { label: "Never cited" }),
    fact("F4", { grade: "C", section: "consumers", method: "csi-v1", snapshotRef: null, observationIds: [1, 2, 3, 4, 5, 6, 7, 8] }),
  ],
  dropped: [{ path: "sections.0.sentences.2", text: "Frase rimossa dal controllo.", reason: "number not in facts" }],
  context: { category: "Formaggi", territory: "Roma", country: "Italia", status: "expanding", statusRule: null, missingInputs: ["csi"], representativenessNote: null, isDemo: true },
};

const meta: BriefDocMeta = {
  title: "Brief: Formaggi, Roma",
  header: [
    { label: "Versione", value: "2" },
    { label: "Modello", value: "model-id" },
  ],
  contextTitle: "Contesto",
  context: [{ label: "Dati mancanti", value: "sentiment" }],
  demoLabel: "DEMO",
  sourcesTitle: "Fonti e cifre",
  columns: { id: "N.", label: "Cifra", value: "Valore", grade: "Grado", period: "Periodo", method: "Metodo", source: "Fonte", reference: "Riferimento" },
  gradeNames: { A: "Dato misurato", B: "Stima da modello", C: "Segnale esplorativo" },
  noGrade: "Grado non disponibile",
  footer: "Legenda dei gradi",
};

describe("briefToDocx", () => {
  it("puts every cited fact in the sources table, with its grade", async () => {
    const xml = unzip(await briefToDocx(content, meta), "word/document.xml");
    const table = xml.slice(xml.indexOf("<w:tbl>"), xml.indexOf("</w:tbl>"));
    const rows = table.split("<w:tr>").slice(1).map(text);
    expect(rows).toHaveLength(1 + 3); // header + F1, F2, F4

    const cited = new Set(content.sections.flatMap((s) => s.sentences.flatMap((x) => x.facts)));
    for (const id of cited) {
      const f = content.facts.find((x) => x.id === id)!;
      const row = rows.find((r) => r.startsWith(id));
      expect(row, `row for ${id}`).toBeDefined();
      expect(row).toContain(f.label);
      expect(row).toContain(f.display);
      expect(row).toContain(`${f.grade} · ${meta.gradeNames[f.grade!]}`);
      expect(row).toContain(f.period);
      expect(row).toContain(f.method);
      expect(row).toContain(f.source);
      expect(row).toContain(factReference(f));
    }
    expect(table).not.toContain("Never cited");
  });

  it("keeps the citation markers beside their sentences and leaves dropped sentences out", async () => {
    const xml = unzip(await briefToDocx(content, meta), "word/document.xml");
    const body = text(xml.slice(0, xml.indexOf("<w:tbl>")));
    expect(body).toContain("Prima frase.[F1]");
    expect(body).toContain("Terza frase.[F2, F4]");
    expect(body).toContain("Seconda frase senza cifre. ");
    expect(body).not.toContain("Frase rimossa");
    expect(body).not.toContain("Limiti"); // a section with no surviving sentence is not printed
    expect(body).toContain("DEMO");
    expect(body).toContain("Modello: model-id");
  });

  it("shows a fact without a grade as ungraded, never as a bare value", async () => {
    const c: BriefContent = { ...content, facts: content.facts.map((f) => (f.id === "F1" ? { ...f, grade: null } : f)) };
    const xml = unzip(await briefToDocx(c, meta), "word/document.xml");
    expect(text(xml)).toContain(`value-F1${meta.noGrade}`);
  });

  it("writes the demo label in the page header", async () => {
    const buf = await briefToDocx(content, meta);
    expect(text(unzip(buf, "word/header1.xml"))).toContain("DEMO");
    const plain = await briefToDocx(content, { ...meta, demoLabel: null });
    expect(text(unzip(plain, "word/header1.xml"))).not.toContain("DEMO");
  });
});

describe("factReference", () => {
  it("names the snapshot and the observations, and truncates long lists", () => {
    expect(factReference(fact("F1"))).toBe("trend_snapshots:1");
    expect(factReference(content.facts[1])).toBe("geo_estimates:7; observations:11, 12");
    expect(factReference(content.facts[3])).toBe("observations:1, 2, 3, 4, 5, 6 (+2)");
    expect(factReference(fact("F9", { snapshotRef: null }))).toBe("–");
  });
});
