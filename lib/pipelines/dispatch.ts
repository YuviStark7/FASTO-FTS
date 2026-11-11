import "server-only";

/**
 * Asks GitHub Actions to process queued source runs now, instead of waiting for the scheduled
 * sweep. Optional: without GITHUB_DISPATCH_TOKEN the queued run is picked up by the schedule.
 * Token: fine-grained, this repository only, "Actions: read and write".
 */
export async function dispatchQueuedRuns(): Promise<"dispatched" | "scheduled"> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY ?? "YuviStark7/FASTO-FTS";
  if (!token) return "scheduled";
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/pipelines.yml/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify({ ref: "main", inputs: { mode: "queued" } }),
    cache: "no-store",
  });
  return res.ok ? "dispatched" : "scheduled";
}
