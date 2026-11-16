import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { deleteBrief, insertBrief } from "./advisor-fixtures";
import { admin, signIn } from "./helpers";

/*
 * Acceptance dashboard (staff read, admins record the hand-kept values).
 * The counters are global to the database and both viewports run in parallel, so the tests that
 * move a counter take a cross-process lock, assert on the change they caused and undo it.
 * `audit_log` is append-only: the entries the manual-value test causes stay there by design.
 */

const LOCK = path.join(os.tmpdir(), "fasto-e2e-acceptance.lock");
async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  for (;;) {
    try {
      fs.mkdirSync(LOCK);
      break;
    } catch {
      // A holder that crashed: steal the lock after two minutes.
      const age = Date.now() - (fs.statSync(LOCK, { throwIfNoEntry: false })?.mtimeMs ?? Date.now());
      if (age > 120_000) fs.rmSync(LOCK, { recursive: true, force: true });
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  try {
    return await fn();
  } finally {
    fs.rmSync(LOCK, { recursive: true, force: true });
  }
}

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const target = (page: Page, slug: string) => page.locator(`[data-testid="target"][data-slug="${slug}"]`);
const valueOf = async (page: Page, slug: string) => Number((await target(page, slug).getByTestId("value").innerText()).replace(/\D/g, ""));

/** Best effort: the database keeps the last admin, so a test admin that is the only one left stays. */
async function dropUser(userId: string) {
  const { data: orgs } = await admin.from("memberships").select("org_id").eq("user_id", userId);
  const { error } = await admin.auth.admin.deleteUser(userId).catch((e: Error) => ({ error: e }));
  if (error) return;
  for (const o of orgs ?? []) await admin.from("organizations").delete().eq("id", o.org_id).eq("is_personal", true);
}

test("a member is refused", async ({ page }) => {
  const { userId } = await signIn(page, "member", "acc");
  try {
    await page.goto("/admin/acceptance");
    await expect(page.getByRole("heading", { name: "Accesso non consentito" })).toBeVisible();
    await expect(page.getByTestId("target")).toHaveCount(0);
    await expect(page.getByTestId("acceptance-summary")).toHaveCount(0);
  } finally {
    await dropUser(userId);
  }
});

test("an analyst sees the nine targets, with categories and territories met, and no editor", async ({ page }, info) => {
  const { userId } = await signIn(page, "analyst", "acc");
  try {
    await page.goto("/admin");
    await page.getByRole("link", { name: /Obiettivi di accettazione/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Obiettivi di accettazione" })).toBeVisible();
    await expect(page.getByTestId("release-date")).toHaveText("domenica 15 novembre 2026");
    await expect(page.getByTestId("acceptance-summary")).toContainText(/su 7 obiettivi di rilascio raggiunti/);
    await expect(page.getByTestId("acceptance-summary")).toContainText("2 obiettivi partono dopo il rilascio");

    const targets = page.getByTestId("target");
    await expect(targets).toHaveCount(9);
    expect(await targets.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.slug))).toEqual([
      "categories",
      "territories",
      "cells",
      "reviewed_sheets",
      "sources",
      "sentiment_controls",
      "reports",
      "firms",
      "trained_users",
    ]);

    for (const [slug, label, n] of [
      ["categories", "Categorie configurate", "15"],
      ["territories", "Territori configurati", "20"],
    ] as const) {
      const row = target(page, slug);
      await expect(row.getByRole("heading", { name: label })).toBeVisible();
      await expect(row).toHaveAttribute("data-state", "met");
      await expect(row.getByTestId("state")).toHaveText("Raggiunto"); // a word, with an icon beside it
      await expect(row.getByTestId("state").locator("svg")).toHaveCount(1);
      await expect(row.getByTestId("value")).toHaveText(n);
      await expect(row).toContainText(`su ${n} per il rilascio`);
      await expect(row.getByTestId("release-target")).toHaveText(n);
      await expect(row.getByTestId("project-target")).toHaveText(n);
      await expect(row.getByTestId("provenance")).toHaveText("Misurato");
      await expect(row.getByTestId("how")).toContainText("Come si misura:");
      await expect(row.getByRole("progressbar", { name: label })).toHaveAttribute("aria-valuetext", `${n} su ${n} per il rilascio`);
    }

    // The release marker sits inside the track only when the two targets differ.
    await expect(target(page, "reviewed_sheets").getByTestId("release-marker")).toHaveCount(1);
    await expect(target(page, "reviewed_sheets").getByTestId("release-target")).toHaveText("5");
    await expect(target(page, "reviewed_sheets").getByTestId("project-target")).toHaveText("30");
    await expect(target(page, "categories").getByTestId("release-marker")).toHaveCount(0);

    // Release target 0: "after release", neither met nor failed, and recorded by hand.
    for (const slug of ["firms", "trained_users"]) {
      const row = target(page, slug);
      await expect(row).toHaveAttribute("data-state", "afterRelease");
      await expect(row.getByTestId("state")).toHaveText("Dopo il rilascio");
      await expect(row.getByTestId("release-target")).toHaveText("parte dopo il rilascio");
      await expect(row.getByTestId("provenance")).toHaveText("Registrato a mano");
    }
    await expect(target(page, "firms").getByTestId("project-target")).toHaveText("15");

    // Analysts read; only admins edit.
    await expect(page.getByRole("button", { name: /Aggiorna il valore/ })).toHaveCount(0);
    await expect(page.getByRole("spinbutton")).toHaveCount(0);

    expect(await noOverflow(page)).toBe(true);
    await page.screenshot({ path: `test-results/acceptance-${info.project.name}.png`, fullPage: true });
    await page.evaluate(() => (document.documentElement.dataset.theme = "light"));
    await page.screenshot({ path: `test-results/acceptance-light-${info.project.name}.png`, fullPage: true });

    await page.goto("/en/admin/acceptance");
    await expect(page.getByRole("heading", { level: 1, name: "Acceptance targets" })).toBeVisible();
    await expect(target(page, "categories").getByTestId("state")).toHaveText("Met");
    await expect(target(page, "categories").getByRole("heading", { name: "Categories configured" })).toBeVisible();
  } finally {
    await dropUser(userId);
  }
});

test("an admin records the number of firms with a note and sees it after the reload", async ({ page }, info) => {
  const note = `Aziende pilota firmate (${info.project.name})`;
  const { userId } = await signIn(page, "admin", "acc");
  try {
    await withLock(async () => {
      try {
        await page.goto("/admin/acceptance");
        const firms = target(page, "firms");
        await expect(firms.getByTestId("value-missing")).toHaveText("Non ancora registrato"); // missing is not zero
        // Measured targets have no editor, hand-recorded ones do.
        await expect(page.getByRole("button", { name: /Aggiorna il valore/ })).toHaveCount(2);
        await expect(target(page, "categories").getByRole("button")).toHaveCount(0);

        await firms.getByRole("button", { name: "Aggiorna il valore: Imprese coinvolte" }).click();
        const value = firms.getByRole("spinbutton", { name: "Valore" });
        // The server refuses a negative number, whatever the browser let through.
        await value.fill("-1");
        await firms.getByRole("button", { name: "Salva" }).click();
        await expect(firms.getByRole("alert")).toHaveText("Serve un numero intero da 0 a 100000.");
        expect((await admin.from("acceptance_targets").select("manual_value").eq("slug", "firms").single()).data?.manual_value).toBeNull();

        await value.fill("2");
        await firms.getByRole("textbox", { name: "Nota" }).fill(note);
        expect(await noOverflow(page)).toBe(true);
        await page.screenshot({ path: `test-results/acceptance-editor-${info.project.name}.png`, fullPage: true });
        // The editor reloads the document after a save. Mark this document, then wait for a new one with the row in it.
        await page.evaluate(() => ((window as unknown as { __before?: boolean }).__before = true));
        await firms.getByRole("button", { name: "Salva" }).click();
        await page.waitForFunction(() => !(window as unknown as { __before?: boolean }).__before && document.querySelector('[data-slug="firms"] [data-testid="value"]') !== null);

        await expect(firms.getByTestId("value")).toHaveText("2");
        await expect(firms).toContainText("su 15 a 12 mesi");
        await expect(firms.getByTestId("manual-note")).toContainText(note);
        await expect(firms.getByTestId("provenance")).toHaveText("Registrato a mano");
        await expect(firms).toHaveAttribute("data-state", "afterRelease"); // still not "met" or "failed"
        await expect(firms.getByRole("spinbutton")).toHaveCount(0); // the editor is closed again

        const { data: row } = await admin.from("acceptance_targets").select("manual_value, manual_note, updated_by").eq("slug", "firms").single();
        expect(row).toEqual({ manual_value: 2, manual_note: note, updated_by: userId });
        await page.screenshot({ path: `test-results/acceptance-admin-${info.project.name}.png`, fullPage: true });
      } finally {
        await admin.from("acceptance_targets").update({ manual_value: null, manual_note: null }).eq("slug", "firms");
      }
    });
  } finally {
    await dropUser(userId);
  }
});

test("a published, checked brief and its export move reviewed sheets and reports", async ({ page }, info) => {
  // One cell per viewport: briefs are unique per category and territory.
  const territory = info.project.name.startsWith("phone") ? "amsterdam" : "bruxelles";
  const { userId } = await signIn(page, "analyst", "acc");
  try {
    await withLock(async () => {
      let briefId: number | undefined;
      try {
        await page.goto("/admin/acceptance");
        await expect(page.getByTestId("target")).toHaveCount(9);
        const before = { sheets: await valueOf(page, "reviewed_sheets"), reports: await valueOf(page, "reports") };

        // A draft with a failing version counts for nothing.
        const draft = await insertBrief({ category: "honey", territory, status: "draft", versions: [{ passed: false }], current: 0 });
        briefId = draft.briefId;
        await page.reload();
        expect(await valueOf(page, "reviewed_sheets")).toBe(before.sheets);
        await deleteBrief(draft.briefId);

        const brief = await insertBrief({ category: "honey", territory, status: "published", versions: [{ passed: true }], current: 0 });
        briefId = brief.briefId;
        const { data: m } = await admin.from("memberships").select("org_id").eq("user_id", userId).single();
        const { error } = await admin.from("exports").insert([
          { org_id: m!.org_id, user_id: userId, brief_version_id: brief.versionIds[0], format: "pdf" },
          { org_id: m!.org_id, user_id: userId, brief_version_id: brief.versionIds[0], format: "docx" }, // same version: one report
        ]);
        if (error) throw error;

        await page.reload();
        expect(await valueOf(page, "reviewed_sheets")).toBe(before.sheets + 1);
        expect(await valueOf(page, "reports")).toBe(before.reports + 1);
        await expect(target(page, "reviewed_sheets")).toHaveAttribute("data-state", before.sheets + 1 >= 5 ? "met" : "inProgress");
        await expect(target(page, "reviewed_sheets").getByTestId("provenance")).toHaveText("Misurato");
        await page.screenshot({ path: `test-results/acceptance-seeded-${info.project.name}.png`, fullPage: true });
      } finally {
        await admin.from("exports").delete().eq("user_id", userId);
        if (briefId !== undefined) await deleteBrief(briefId);
      }
    });
  } finally {
    await dropUser(userId);
  }
});
