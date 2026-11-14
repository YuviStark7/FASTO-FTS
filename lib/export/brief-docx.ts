/**
 * Word export of a brief. Pure: content and already-translated labels in, .docx bytes out.
 * The same rule as on screen: every sentence keeps its citation markers, and every cited fact is
 * in the sources table with its grade. Nothing is recomputed or reformatted here.
 */
import { Document, Footer, Header, HeadingLevel, PageNumber, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import type { BriefContent, Fact, Grade } from "@/lib/ai/brief/types";
import { citedFacts } from "@/lib/advisor/content";

export type BriefDocMeta = {
  title: string;
  /** Category, city, version, status, generation date, model, prompt version... in display order. */
  header: { label: string; value: string }[];
  /** Cell status, rule, missing inputs, representativeness note. */
  contextTitle: string;
  context: { label: string; value: string }[];
  /** Set when the brief rests on demo data: repeated on every page. */
  demoLabel: string | null;
  sourcesTitle: string;
  columns: { id: string; label: string; value: string; grade: string; period: string; method: string; source: string; reference: string };
  gradeNames: Record<Grade, string>;
  noGrade: string;
  footer: string;
};

/** Where a fact comes from: its snapshot and, when present, the observations behind it. */
export function factReference(f: Fact): string {
  const shown = f.observationIds.slice(0, 6).join(", ");
  const more = f.observationIds.length > 6 ? ` (+${f.observationIds.length - 6})` : "";
  const obs = f.observationIds.length ? `observations:${shown}${more}` : "";
  return [f.snapshotRef, obs].filter(Boolean).join("; ") || "–";
}

export const gradeText = (f: Fact, meta: Pick<BriefDocMeta, "gradeNames" | "noGrade">) => (f.grade ? `${f.grade} · ${meta.gradeNames[f.grade]}` : meta.noGrade);

const FONT = "Calibri";
const run = (text: string, o: Partial<{ bold: boolean; size: number; superScript: boolean; color: string; italics: boolean }> = {}) => new TextRun({ text, font: FONT, ...o });
const cell = (text: string, o: { bold?: boolean; width: number }) =>
  new TableCell({
    width: { size: o.width, type: WidthType.PERCENTAGE },
    margins: { top: 40, bottom: 40, left: 70, right: 70 },
    children: [new Paragraph({ children: [run(text, { size: 16, bold: o.bold })] })],
  });

const WIDTHS = [5, 24, 13, 12, 9, 9, 12, 16];

export async function briefToDocx(content: BriefContent, meta: BriefDocMeta): Promise<Buffer> {
  const sections = content.sections.filter((s) => s.sentences.length > 0);
  const facts = citedFacts(sections.flatMap((s) => s.sentences), content.facts);
  const c = meta.columns;

  const body: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [run(meta.title, { size: 44 })] }),
    ...(meta.demoLabel ? [new Paragraph({ children: [run(meta.demoLabel, { bold: true, size: 24, color: "B34A0A" })] })] : []),
    ...meta.header.map((h) => new Paragraph({ spacing: { after: 20 }, children: [run(`${h.label}: `, { bold: true, size: 18 }), run(h.value, { size: 18 })] })),
  ];

  for (const s of sections) {
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 280, after: 80 }, children: [run(s.heading, { bold: true, size: 26 })] }));
    body.push(
      new Paragraph({
        spacing: { after: 120, line: 300 },
        children: s.sentences.flatMap((sentence) => [
          run(sentence.text, { size: 22 }),
          ...(sentence.facts.length ? [run(`[${sentence.facts.join(", ")}]`, { size: 22, superScript: true, bold: true })] : []),
          run(" ", { size: 22 }),
        ]),
      }),
    );
  }

  body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 280, after: 80 }, children: [run(meta.contextTitle, { bold: true, size: 26 })] }));
  for (const x of meta.context) body.push(new Paragraph({ spacing: { after: 60 }, children: [run(`${x.label}: `, { bold: true, size: 20 }), run(x.value, { size: 20 })] }));

  body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 280, after: 120 }, children: [run(meta.sourcesTitle, { bold: true, size: 26 })] }));
  body.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [c.id, c.label, c.value, c.grade, c.period, c.method, c.source, c.reference].map((h, i) => cell(h, { bold: true, width: WIDTHS[i] })),
        }),
        ...facts.map(
          (f) =>
            new TableRow({
              cantSplit: true,
              children: [f.id, f.label, f.display, gradeText(f, meta), f.period, f.method, f.source, factReference(f)].map((v, i) => cell(v, { width: WIDTHS[i] })),
            }),
        ),
      ],
    }),
  );

  const doc = new Document({
    title: meta.title,
    sections: [
      {
        properties: { page: { margin: { top: 1000, bottom: 1000, left: 900, right: 900 } } },
        headers: {
          default: new Header({
            children: [new Paragraph({ children: [run(meta.title, { size: 16, color: "5B6472" }), ...(meta.demoLabel ? [run(`   ${meta.demoLabel}`, { size: 16, bold: true, color: "B34A0A" })] : [])] })],
          }),
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({ children: [run(`${meta.footer}   `, { size: 14, color: "5B6472" }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 14, color: "5B6472" })] })],
          }),
        },
        children: body,
      },
    ],
  });
  return Packer.toBuffer(doc);
}
