import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

test("map lists the 20 pilot cities, follows the category and opens the sheet", async ({ page }, info) => {
  await signIn(page);
  await page.goto("/map");
  await expect(page.getByRole("heading", { level: 1, name: "Mappa" })).toBeVisible();

  const list = page.getByTestId("map-city-list");
  await expect(list.getByRole("button")).toHaveCount(20);

  const cats = page.getByRole("radiogroup", { name: "Scegli una categoria" }).getByRole("radio");
  expect(await cats.count()).toBe(15);
  await cats.nth(1).click();
  await expect(cats.nth(1)).toHaveAttribute("aria-checked", "true");
  await expect(list.getByRole("button")).toHaveCount(20);

  // Every city names its status and its local demand (or "dati insufficienti") in words.
  const names = await list.getByRole("button").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
  expect(names.every((n) => n.includes("domanda locale"))).toBe(true);

  await list.getByRole("button").first().focus();
  await page.keyboard.press("Enter");
  const sheet = page.getByTestId("city-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Apri la scheda" })).toHaveAttribute("href", /\/cell\/[^/]+\/[^/]+$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test-results/map-${info.project.name}.png` });
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});
