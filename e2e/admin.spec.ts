import { test, expect } from "@playwright/test";
import { admin, signIn } from "./helpers";

test("a member is shown the not-allowed state, with no Rerun button", async ({ page }) => {
  await signIn(page, "member", "adm");
  for (const path of ["/admin", "/admin/sources", "/admin/runs"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Accesso non consentito" })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: /Riavvia/ })).toHaveCount(0);
});

test("the More page links to Administration for analysts only", async ({ page, context }, info) => {
  const { userId } = await signIn(page, "analyst", "adm");
  try {
    await page.goto("/more");
    await expect(page.getByRole("link", { name: "Amministrazione" })).toBeVisible();
    await context.clearCookies();
    await signIn(page, "member", "adm");
    await page.goto("/more");
    await expect(page.getByRole("heading", { name: "Altro" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Amministrazione" })).toHaveCount(0);
  } finally {
    await admin.from("source_runs").delete().eq("requested_by", userId);
  }
  void info;
});

test("an analyst reruns Eurostat and sees the queued run", async ({ page }, info) => {
  const { userId } = await signIn(page, "analyst", "adm");
  try {
    await page.goto("/admin");
    await page.getByRole("link", { name: /Fonti/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Fonti" })).toBeVisible();
    // Analysts do not get the active toggle.
    await expect(page.getByRole("switch")).toHaveCount(0);

    const rerun = page.getByRole("button", { name: /Riavvia Eurostat/ });
    await expect(rerun).toBeEnabled();
    await rerun.click();
    await expect(page.getByText(/^(Avviato\.|In coda: parte entro 30 minuti\.)$/)).toBeVisible();
    await expect(rerun).toBeDisabled(); // no double submit while queued

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/admin-sources-${info.project.name}.png` });

    await page.goto("/admin/runs");
    await expect(page.getByRole("heading", { level: 1, name: "Esecuzioni" })).toBeVisible();
    const run = page.getByTestId("run").filter({ hasText: "In coda" }).filter({ hasText: /Eurostat/i }).first();
    await expect(run).toBeVisible();
    await expect(page.getByText("Aggiornamento automatico ogni 10 secondi.")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/admin-runs-${info.project.name}.png` });
  } finally {
    await admin.from("source_runs").delete().eq("requested_by", userId);
  }
});
