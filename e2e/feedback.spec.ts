import { test, expect } from "@playwright/test";
import { admin, signIn } from "./helpers";

// Both viewport projects run in parallel: each one links its fixture to a different cheese cell.
const CELL_BY_PROJECT: Record<string, string> = { "phone-390": "milano", "desktop-1440": "roma" };

test("member rates a published CSI reading, it persists after reload; viewer cannot rate", async ({ page, browser }) => {
  const project = test.info().project.name;
  const territorySlug = CELL_BY_PROJECT[project] ?? "milano";

  const { data: cat } = await admin.from("categories").select("id").eq("slug", "cheese").single();
  const { data: ter } = await admin.from("territories").select("id").eq("slug", territorySlug).single();
  const { data: cell } = await admin.from("cells").select("csi_snapshot_id").eq("category_id", cat!.id).eq("territory_id", ter!.id).single();
  const { data: snap, error } = await admin
    .from("csi_snapshots")
    .insert({
      category_id: cat!.id,
      territory_id: ter!.id,
      period_start: "2026-01-01",
      period_end: "2026-06-30",
      csi: 60,
      n_mentions: 60,
      languages: ["it"],
      representativeness_note: "TEST",
      is_published: true,
      grade: "C",
      method_version_id: "csi-v1",
      is_demo: true,
    })
    .select("id")
    .single();
  if (error) throw error;
  const snapId = snap!.id;

  try {
    await admin.from("cells").update({ csi_snapshot_id: snapId }).eq("category_id", cat!.id).eq("territory_id", ter!.id);
    const { userId } = await signIn(page, "member", "fb");

    await page.goto(`/cell/cheese/${territorySlug}`);
    await page.getByRole("tab", { name: "Consumatori" }).click();
    const control = page.getByTestId("feedback-control");
    await expect(control.getByText("Questa lettura del sentiment è corretta?")).toBeVisible();
    await expect(page.getByRole("tabpanel").getByText("DEMO").first()).toBeVisible();
    // Every sentiment figure is graded and opens its provenance (product rules 1 and 4).
    await page.getByRole("button", { name: /^Dettaglio del dato/ }).first().click();
    await page.getByRole("button", { name: "Vedi provenienza" }).click();
    await expect(page.locator("#csi-provenance")).toBeFocused();

    const wrong = control.getByRole("button", { name: "Sbagliata" });
    await expect(wrong).toBeVisible();
    await expect(wrong).toHaveAttribute("aria-pressed", "false");
    await control.getByLabel(/Commento/).fill("Troppo ottimista");
    // Keyboard: focus and press.
    await expect(async () => {
      await wrong.focus();
      await page.keyboard.press("Enter");
      await expect(control.getByText("Valutazione salvata.")).toBeVisible({ timeout: 1500 });
    }).toPass();
    await expect(wrong).toHaveAttribute("aria-pressed", "true");

    // Change of mind: upsert, not a second row.
    await control.getByRole("button", { name: "Parzialmente corretta" }).click();
    await expect(control.getByRole("button", { name: "Parzialmente corretta" })).toHaveAttribute("aria-pressed", "true");
    await expect(control.getByText("Valutazione salvata.")).toBeVisible();

    await page.reload();
    await page.getByRole("tab", { name: "Consumatori" }).click();
    const again = page.getByTestId("feedback-control");
    await expect(again.getByRole("button", { name: "Parzialmente corretta" })).toHaveAttribute("aria-pressed", "true");
    await expect(again.getByLabel(/Commento/)).toHaveValue("Troppo ottimista");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/feedback-${project}.png`, fullPage: true });

    const { data: rows } = await admin.from("feedback").select("rating").eq("user_id", userId).eq("target_type", "csi_snapshot").eq("target_id", snapId);
    expect(rows).toEqual([{ rating: "partly_right" }]);

    // Viewer: sees the explanation, no buttons.
    const ctx = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
    const vp = await ctx.newPage();
    await signIn(vp, "viewer", "fb");
    await vp.goto(`/cell/cheese/${territorySlug}`);
    await vp.getByRole("tab", { name: "Consumatori" }).click();
    await expect(vp.getByText("Il tuo ruolo è di sola lettura")).toBeVisible();
    await expect(vp.getByRole("button", { name: "Sbagliata" })).toHaveCount(0);
    await ctx.close();
  } finally {
    await admin.from("feedback").delete().eq("target_type", "csi_snapshot").eq("target_id", snapId);
    await admin.from("cells").update({ csi_snapshot_id: cell!.csi_snapshot_id }).eq("category_id", cat!.id).eq("territory_id", ter!.id);
    await admin.from("csi_snapshots").delete().eq("id", snapId);
  }
});
