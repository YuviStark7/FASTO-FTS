/**
 * Pipeline CLI.
 *   pnpm pipeline <source> [--dry-run] [--param key=value]   run one connector
 *   pnpm pipeline all                                         run every connector, then compute
 *   pnpm pipeline --queued                                    run every queued source_run (Admin reruns)
 *   pnpm pipeline compute                                     recompute snapshots and cells
 */
import { serviceClient } from "./shared/db";
import { runConnector } from "./shared/runner";
import { CONNECTORS, registry } from "./registry";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const params: Record<string, string> = {};
  args.forEach((a, i) => {
    if (a === "--param" && args[i + 1]?.includes("=")) {
      const [k, ...v] = args[i + 1].split("=");
      params[k] = v.join("=");
    }
  });
  const db = serviceClient();

  if (args[0] === "compute") {
    const { computeAll } = await import("./compute/compute");
    await computeAll(db);
    return;
  }

  if (args[0] === "all") {
    // Weekly refresh: every connector in turn; one failure never stops the others.
    let failed = 0;
    for (const slug of CONNECTORS) {
      const report = await safeRun(slug, { db });
      if (report !== "succeeded" && report !== "partial") failed++;
    }
    const { computeAll } = await import("./compute/compute");
    await computeAll(db);
    process.exitCode = failed ? 1 : 0;
    return;
  }

  if (args.includes("--queued")) {
    const { data, error } = await db
      .from("source_runs")
      .select("id, params, sources(slug)")
      .eq("status", "queued")
      .order("requested_at");
    if (error) throw new Error(error.message);
    let failed = 0;
    for (const run of data ?? []) {
      const slug = (run.sources as unknown as { slug: string }).slug;
      const status = await safeRun(slug, { db, runId: run.id, params: (run.params ?? {}) as Record<string, string> });
      if (status !== "succeeded" && status !== "partial") failed++;
    }
    if ((data ?? []).length) {
      const { computeAll } = await import("./compute/compute");
      await computeAll(db);
    }
    process.exitCode = failed ? 1 : 0;
    return;
  }

  const slug = args[0];
  const load = registry[slug];
  if (!load) throw new Error(`unknown connector "${slug}". Known: ${Object.keys(registry).join(", ") || "none"}`);
  const report = await runConnector(await load(), { db, dryRun, params });
  console.log(JSON.stringify({ ...report, rows: report.rows.length, rejected: report.rejected.slice(0, 20) }, null, 2));
  if (report.status === "failed") process.exitCode = 1;
}

/**
 * Runs one connector and never throws: a connector that cannot load or crashes marks its own
 * run failed, so a queued run can never stay "queued" and block the ones behind it.
 */
async function safeRun(slug: string, opts: { db: ReturnType<typeof serviceClient>; runId?: number; params?: Record<string, string> }) {
  const fail = async (reason: string) => {
    console.error(`${slug}: ${reason}`);
    if (opts.runId) {
      await opts.db
        .from("source_runs")
        .update({ status: "failed", finished_at: new Date().toISOString(), errors: [{ reason }] })
        .eq("id", opts.runId);
    }
    return "failed" as const;
  };
  const load = registry[slug];
  if (!load) return fail(`no connector for ${slug}`);
  try {
    const report = await runConnector(await load(), opts);
    console.log(`${slug}${opts.runId ? ` run ${opts.runId}` : ""}: ${report.status} (${report.written} written, ${report.rejected.length} rejected)`);
    return report.status;
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
