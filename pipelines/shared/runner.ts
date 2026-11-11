import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { httpGet } from "./http";
import { normalise, type ObservationRow, type Rejected } from "./normalise";
import { loadTaxonomy } from "./taxonomy";
import type { Connector, ConnectorContext, RawFile } from "./types";

export type RunOptions = {
  db: SupabaseClient;
  /** Claim an existing queued run (from Admin) instead of creating one. */
  runId?: number;
  params?: Record<string, string>;
  /** Validate and report, but write nothing to the database or storage. */
  dryRun?: boolean;
  /** Where dry runs keep raw files. */
  outDir?: string;
};

export type RunReport = {
  runId: number | null;
  status: "succeeded" | "partial" | "failed";
  fetched: number;
  written: number;
  rejected: Rejected[];
  rows: ObservationRow[];
  error?: string;
};

const CONFLICT = "category_id,territory_id,indicator_id,series_key,period_start,period_end,source_id,method_version_id";

export async function runConnector(connector: Connector, opts: RunOptions): Promise<RunReport> {
  const { db, dryRun = false } = opts;
  const taxonomy = await loadTaxonomy(db);
  const source = taxonomy.sources.get(connector.source);
  if (!source) throw new Error(`source ${connector.source} is not in the sources table`);

  let runId: number | null = null;
  if (!dryRun) {
    if (opts.runId) {
      const { error } = await db
        .from("source_runs")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", opts.runId)
        .eq("status", "queued");
      if (error) throw new Error(`claim run ${opts.runId}: ${error.message}`);
      runId = opts.runId;
    } else {
      const { data, error } = await db
        .from("source_runs")
        .insert({ source_id: source.id, status: "running", params: opts.params ?? {}, started_at: new Date().toISOString() })
        .select("id")
        .single();
      if (error) throw new Error(`create run: ${error.message}`);
      runId = data.id;
    }
  }

  const logLines: string[] = [];
  const warnings: string[] = [];
  const ctx: ConnectorContext = {
    taxonomy,
    get: (url, init) => httpGet(url, init),
    storeRaw: (file) => storeRaw(file, { db, dryRun, runId, source: connector.source, outDir: opts.outDir }),
    warn: (m) => {
      warnings.push(m);
      console.warn(`[${connector.source}] WARN ${m}`);
    },
    log: (m) => {
      logLines.push(m);
      console.log(`[${connector.source}] ${m}`);
    },
    params: opts.params ?? {},
  };

  try {
    const inputs = await connector.run(ctx);
    const { rows, rejected } = normalise(inputs, taxonomy, { source: connector.source, runId });
    let written = 0;
    if (!dryRun) {
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await db.from("observations").upsert(chunk, { onConflict: CONFLICT });
        if (error) throw new Error(`write observations: ${error.message}`);
        written += chunk.length;
      }
    }
    const status = rejected.length || warnings.length ? "partial" : "succeeded";
    if (!dryRun) await finish(db, runId!, status, inputs.length, written, rejected, [...logLines, ...warnings.map((w) => `WARN ${w}`)]);
    return { runId, status, fetched: inputs.length, written, rejected, rows };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!dryRun && runId) await finish(db, runId, "failed", 0, 0, [], [...logLines, `ERROR ${message}`]);
    return { runId, status: "failed", fetched: 0, written: 0, rejected: [], rows: [], error: message };
  }
}

async function finish(
  db: SupabaseClient,
  runId: number,
  status: string,
  fetched: number,
  written: number,
  rejected: Rejected[],
  log: string[],
) {
  const errors = [
    ...rejected.slice(0, 50).map((r) => ({ reason: r.reason, ref: r.input.sourceRef })),
    ...log.filter((l) => l.startsWith("ERROR") || l.startsWith("WARN")).map((l) => ({ reason: l })),
  ];
  const { error } = await db
    .from("source_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      rows_fetched: fetched,
      rows_inserted: written,
      rows_rejected: rejected.length,
      errors,
    })
    .eq("id", runId);
  if (error) console.error(`could not close run ${runId}: ${error.message}`);
}

async function storeRaw(
  file: RawFile,
  o: { db: SupabaseClient; dryRun: boolean; runId: number | null; source: string; outDir?: string },
) {
  const sha256 = createHash("sha256").update(file.bytes).digest("hex");
  const safe = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
  if (o.dryRun) {
    const dir = path.join(o.outDir ?? ".pipeline-out", o.source);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, safe), file.bytes);
    return;
  }
  const storagePath = `${o.source}/${o.runId}/${safe}`;
  const up = await o.db.storage.from("raw-files").upload(storagePath, file.bytes, { contentType: file.contentType, upsert: true });
  if (up.error) throw new Error(`store raw ${storagePath}: ${up.error.message}`);
  const { error } = await o.db.from("raw_files").insert({
    run_id: o.runId,
    storage_path: storagePath,
    sha256,
    bytes: file.bytes.byteLength,
    content_type: file.contentType,
    url: file.url ?? null,
  });
  if (error) throw new Error(`log raw file: ${error.message}`);
}
