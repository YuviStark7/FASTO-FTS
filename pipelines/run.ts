/**
 * Pipeline CLI.
 *   pnpm pipeline <source> [--dry-run] [--param key=value]   run one connector
 *   pnpm pipeline --queued                                    run every queued source_run (Admin reruns)
 *   pnpm pipeline compute                                     recompute snapshots and cells
 */
import { serviceClient } from "./shared/db";
import { runConnector } from "./shared/runner";
import { registry } from "./registry";

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
      const load = registry[slug];
      if (!load) {
        await db.from("source_runs").update({ status: "failed", finished_at: new Date().toISOString(), errors: [{ reason: `no connector for ${slug}` }] }).eq("id", run.id);
        failed++;
        continue;
      }
      const report = await runConnector(await load(), { db, runId: run.id, params: (run.params ?? {}) as Record<string, string> });
      console.log(`run ${run.id} ${slug}: ${report.status} (${report.written} written, ${report.rejected.length} rejected)`);
      if (report.status === "failed") failed++;
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

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
