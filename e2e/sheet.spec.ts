import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

const TABS = ["Mercato", "Territorio", "Consumatori", "Concorrenza", "Opportunità", "Fonti"];

test("organic in Roma is insufficient and says so on the Market tab", async ({ page }) => {
  await signIn(page);
  await page.goto("/cell/organic/roma");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Roma");
  await expect(page.getByText("Dati insufficienti").first()).toBeVisible();
  await expect(page.getByText("Non ci sono ancora abbastanza dati misurati")).toBeVisible();
  await expect(page.getByRole("tabpanel").getByText("Dati insufficienti").first()).toBeVisible();
  await expect(page.getByRole("tabpanel").getByText(/Dati nazionali/)).toBeVisible();
  await expect(page.getByText(/Trend nazionale \(Italia\)/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/sheet-organic-${test.info().project.name}.png`, fullPage: true });
});

test("cheese in Milano: tabs by keyboard, sources ledger, figure detail", async ({ page }) => {
  await signIn(page);
  await page.goto("/cell/cheese/milano");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Milano");
  const tablist = page.getByRole("tablist", { name: "Sezioni della scheda" });
  await expect(tablist.getByRole("tab")).toHaveCount(6);

  // All six tabs reachable with the arrow keys.
  // The first press can land before hydration: retry it until the handler is attached.
  await expect(async () => {
    await tablist.getByRole("tab", { name: TABS[0] }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(tablist.getByRole("tab", { name: TABS[1] })).toHaveAttribute("aria-selected", "true", { timeout: 1000 });
  }).toPass();
  for (let i = 2; i < TABS.length; i++) {
    await page.keyboard.press("ArrowRight");
    await expect(tablist.getByRole("tab", { name: TABS[i] })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toBeVisible();
    await expect(tablist.getByRole("tab", { name: TABS[i] })).toBeFocused();
  }
  // Sources tab: table present, then rows or the empty state.
  await expect(page.getByRole("table")).toBeAttached();
  const rows = await page.getByTestId("ledger").locator("tbody tr").count();
  if (rows === 0) await expect(page.getByText("Nessuna osservazione collegata")).toBeVisible();
  await expect(page.getByText("Source: Eurostat")).toBeVisible();
  await expect(page.getByText("© OpenStreetMap contributors (ODbL)")).toBeVisible();
  await page.screenshot({ path: `test-results/sheet-sources-${test.info().project.name}.png`, fullPage: true });

  // Back to Market: a figure opens its detail and "Vedi fonti" filters the ledger.
  await tablist.getByRole("tab", { name: "Mercato" }).click();
  const fig = page.getByRole("tabpanel").getByRole("button", { name: /Dettaglio del dato/ }).first();
  if (await fig.count()) {
    await fig.click();
    const dlg = page.getByRole("dialog");
    await expect(dlg).toBeVisible();
    await expect(dlg.getByText("Versione del metodo")).toBeVisible();
    const see = dlg.getByRole("button", { name: "Vedi fonti" });
    if (await see.count()) {
      await see.click();
      await expect(tablist.getByRole("tab", { name: "Fonti" })).toHaveAttribute("aria-selected", "true");
      await expect(page.getByText(/Filtro attivo/)).toBeVisible();
      await page.getByRole("button", { name: "Mostra tutte" }).click();
      await expect(page.getByText(/Filtro attivo/)).toHaveCount(0);
    }
  }
  await tablist.getByRole("tab", { name: "Mercato" }).click();
  await page.screenshot({ path: `test-results/sheet-cheese-${test.info().project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("unknown slug is not found", async ({ page }) => {
  await signIn(page);
  await page.goto("/cell/nonsense/atlantis");
  await expect(page.getByRole("heading", { name: "Cella non trovata" })).toBeVisible();
});
