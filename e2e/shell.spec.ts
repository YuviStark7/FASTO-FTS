import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("chip expands, navigates to Matrice and shows the active page", async ({ page }, info) => {
  await signIn(page);
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Navigazione principale" });
  const chip = nav.getByRole("button");
  await expect(chip).toHaveAttribute("aria-expanded", "false");
  await page.screenshot({ path: `test-results/shell-chip-collapsed-${info.project.name}.png` });
  await chip.click();
  await expect(chip).toHaveAttribute("aria-expanded", "true");
  await expect(nav.getByRole("link", { name: "Scout" })).toHaveAttribute("aria-current", "page");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/shell-chip-expanded-${info.project.name}.png` });
  await nav.getByRole("link", { name: "Matrice" }).click();
  await expect(page).toHaveURL(/\/matrix/);
  await expect(chip).toHaveAttribute("aria-expanded", "false");
  await expect(chip).toHaveAccessibleName(/Pagina attuale: Matrice/);
  await chip.click();
  await expect(nav.getByRole("link", { name: "Matrice" })).toHaveAttribute("aria-current", "page");
  const box = await nav.getByRole("link", { name: "Chiedi" }).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press("Escape");
  await expect(chip).toHaveAttribute("aria-expanded", "false");
});

test("profile menu signs out", async ({ page }, info) => {
  const { email } = await signIn(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Profilo e impostazioni" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu).toContainText(email);
  await expect(menu.getByRole("menuitem", { name: "Mappa" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Amministrazione" })).toHaveCount(0);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/shell-profile-menu-${info.project.name}.png` });
  await menu.getByRole("menuitem", { name: "Esci" }).click();
  await page.waitForURL(/\/login/);
});

test("keyboard: Tab to chip, Enter expands, arrow to Matrice, Enter navigates", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "keyboard flow is desktop");
  await signIn(page);
  await page.goto("/");
  const chip = page.getByRole("navigation", { name: "Navigazione principale" }).getByRole("button");
  await chip.focus();
  await expect(chip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(chip).toHaveAttribute("aria-expanded", "true");
  await page.waitForTimeout(300);
  await page.keyboard.press("ArrowRight"); // Scout
  await page.keyboard.press("ArrowRight"); // Matrice
  await expect(page.getByRole("link", { name: "Matrice" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/matrix/);
});

test("profile menu keyboard and no horizontal overflow", async ({ page }) => {
  await signIn(page);
  await page.goto("/");
  const btn = page.getByRole("button", { name: "Profilo e impostazioni" });
  await btn.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem").first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem").nth(1)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(btn).toHaveAttribute("aria-expanded", "false");
  for (const path of ["/", "/matrix", "/more"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
