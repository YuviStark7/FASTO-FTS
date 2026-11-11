import { test, expect } from "@playwright/test";
import { admin, signIn } from "./helpers";

// Phone and desktop run in parallel: separate cells, and counts are asserted per fixture card.
const CELL_BY_PROJECT: Record<string, string> = { "phone-390": "torino", "desktop-1440": "napoli" };

test("admin sees the control-case counter and a reading's counts; member is refused", async ({ page, browser }) => {
  const project = test.info().project.name;
  const slug = CELL_BY_PROJECT[project] ?? "torino";
  const { data: cat } = await admin.from("categories").select("id").eq("slug", "cheese").single();
  const { data: ter } = await admin.from("territories").select("id").eq("slug", slug).single();
  const { data: cell } = await admin.from("cells").select("csi_snapshot_id").eq("category_id", cat!.id).eq("territory_id", ter!.id).single();
  const { data: snap, error } = await admin
    .from("csi_snapshots")
    .insert({
      category_id: cat!.id, territory_id: ter!.id, period_start: "2026-01-01", period_end: "2026-06-30", csi: 60, n_mentions: 60,
      languages: ["it"], representativeness_note: "TEST", is_published: true, grade: "C", method_version_id: "csi-v1", is_demo: true,
    })
    .select("id")
    .single();
  if (error) throw error;
  const snapId = snap!.id;
  const ctxs: { close(): Promise<void> }[] = [];

  try {
    const m1 = await signIn(page, "member", "fba");
    const { data: mem } = await admin.from("memberships").select("org_id").eq("user_id", m1.userId).single();
    const ctx2 = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
    ctxs.push(ctx2);
    const p2 = await ctx2.newPage();
    const m2 = await signIn(p2, "member", "fba");
    const { data: mem2 } = await admin.from("memberships").select("org_id").eq("user_id", m2.userId).single();
    const rows = [
      { org_id: mem!.org_id, user_id: m1.userId, target_type: "csi_snapshot", target_id: snapId, rating: "right", comment: "Ottimo caso" },
      { org_id: mem2!.org_id, user_id: m2.userId, target_type: "csi_snapshot", target_id: snapId, rating: "wrong", comment: null },
    ];
    const { error: fe } = await admin.from("feedback").insert(rows);
    if (fe) throw fe;

    // Member: not allowed.
    await page.goto("/admin/feedback");
    await expect(page.getByText("Accesso non consentito")).toBeVisible();

    // Admin.
    const ctx3 = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
    ctxs.push(ctx3);
    const ap = await ctx3.newPage();
    await signIn(ap, "admin", "fba");
    await ap.goto("/admin");
    await ap.getByRole("link", { name: /Valutazioni del sentiment/ }).click();
    await expect(ap.getByRole("heading", { level: 1, name: "Valutazioni del sentiment" })).toBeVisible();
    await expect(ap.getByTestId("control-cases")).toContainText(/Casi di controllo sentiment: \d+/);
    const card = ap.getByTestId("feedback-case").filter({ hasText: "CSI 60, 60 menzioni" }).filter({ hasText: /Torino|Napoli/ });
    await expect(card).toHaveCount(1);
    await expect(card.getByText("DEMO")).toBeVisible();
    await expect(card.getByText("Corretta: 1", { exact: false })).toBeVisible();
    await expect(card.getByText("Sbagliata: 1")).toBeVisible();
    await expect(card.getByText("Parzialmente corretta: 0")).toBeVisible();
    await expect(card.getByText("“Ottimo caso”")).toBeVisible();
    expect(await ap.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await ap.screenshot({ path: `test-results/feedback-admin-${project}.png`, fullPage: true });
  } finally {
    await admin.from("feedback").delete().eq("target_type", "csi_snapshot").eq("target_id", snapId);
    await admin.from("cells").update({ csi_snapshot_id: cell!.csi_snapshot_id }).eq("category_id", cat!.id).eq("territory_id", ter!.id);
    await admin.from("csi_snapshots").delete().eq("id", snapId);
    for (const c of ctxs) await c.close();
  }
});
