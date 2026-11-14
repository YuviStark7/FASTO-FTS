import { test, expect, type Page } from "@playwright/test";
import { signIn } from "./helpers";

const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function bloom(page: Page, phone: boolean) {
  const chip = page.getByTestId("scout-chip-category");
  if (phone) await chip.tap();
  else await chip.hover();
  await expect(page.getByTestId("scout-zone")).toHaveAttribute("data-state", "bloomed");
  await page.waitForTimeout(700); // let the bloom settle
}

test("Scout loads collapsed with the verdict and two pills, frames carry grade badges", async ({ page }, info) => {
  await signIn(page);
  await page.goto("/");
  const zone = page.getByTestId("scout-zone");
  await expect(zone).toHaveAttribute("data-state", "collapsed");
  await expect(page.getByRole("heading", { level: 1, name: /^(In espansione|Consolidato|Minacciato|Dati insufficienti)$/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Apri la scheda", exact: true }).first()).toHaveAttribute("href", /\/cell\/[^/]+\/[^/]+$/);
  await expect(page.getByRole("link", { name: /^MOS( \d+.*| non disponibile)$/ })).toHaveAttribute("href", /\/matrix\?mode=mos&c=[^&]+&t=/);

  // Frames: each shows its label plus a grade badge, or the hatched insufficient state. Never a bare number.
  const frames = page.getByTestId("scout-frames").locator("li");
  await expect(frames.first().getByRole("link")).toBeVisible();
  const n = await frames.count();
  expect(n).toBeGreaterThanOrEqual(4);
  for (let i = 0; i < n; i++) {
    const f = frames.nth(i);
    if (!(await f.isVisible())) continue; // desktop-only frames are hidden on phones
    const graded = await f.locator("abbr.grade").count();
    const hatched = (await f.textContent())?.includes("Dati insufficienti");
    expect(graded > 0 || hatched).toBe(true);
  }
  expect(await noSideScroll(page)).toBe(true);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `test-results/scout-collapsed-${info.project.name}.png` });
});

test("MOS pill opens the matrix in MOS mode with the cell highlighted", async ({ page }, info) => {
  await signIn(page);
  await page.goto("/?c=honey&t=bologna");
  await page.getByRole("link", { name: /^MOS( \d+.*| non disponibile)$/ }).click();
  await expect(page).toHaveURL(/\/matrix\?mode=mos&c=honey&t=bologna/);
  await expect(page.getByRole("button", { name: "MOS", exact: true })).toHaveAttribute("aria-pressed", "true");
  const current = page.locator("[data-matrix-target]:visible");
  await expect(current).toHaveCount(1);
  await expect(current).toHaveAttribute("aria-label", /Miele a Bologna/);
  await expect(current).toBeInViewport();
  expect(await noSideScroll(page)).toBe(true);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test-results/scout-matrix-mos-${info.project.name}.png` });
});

test("flower blooms, category and city are typeahead tags, URL follows", async ({ page }, info) => {
  const phone = info.project.name.startsWith("phone");
  await signIn(page);
  await page.goto("/");
  await bloom(page, phone);

  const petals = page.getByRole("radiogroup", { name: "Scegli una categoria" }).getByRole("radio");
  await expect(petals).toHaveCount(15);
  await expect(page.getByRole("radio", { checked: true })).toBeVisible();
  expect(await noSideScroll(page)).toBe(true);
  await page.screenshot({ path: `test-results/scout-bloomed-${info.project.name}.png` });

  // Category tag: typing "form" picks Formaggi (accent- and case-insensitive).
  await page.getByTestId("scout-category-tag").click();
  const catInput = page.getByRole("combobox", { name: "Cambia categoria" });
  await catInput.fill("form");
  await expect(page.getByRole("option", { name: "Formaggi" })).toBeVisible();
  await catInput.press("Enter");
  await expect(page.getByRole("radio", { name: "Formaggi" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("scout-category-tag")).toHaveText(/Formaggi/i);

  // Escape cancels without changing anything and keeps the flower open.
  await page.getByTestId("scout-category-tag").click();
  await page.getByRole("combobox", { name: "Cambia categoria" }).fill("mie");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("scout-category-tag")).toHaveText(/Formaggi/i);
  await expect(page.getByTestId("scout-zone")).toHaveAttribute("data-state", "bloomed");

  // Location chip: 20 pilot cities with country codes; "mil" picks Milano.
  await page.getByTestId("scout-territory-tag").click();
  const terInput = page.getByRole("combobox", { name: "Cambia città" });
  await expect(page.getByRole("option")).toHaveCount(20);
  await terInput.fill("mil");
  await terInput.press("Enter");
  await expect(page.getByTestId("scout-territory-tag")).toHaveText(/Milano/i);
  await expect(page).toHaveURL(/c=cheese&t=milano/);

  // Leaving the flower (tap outside on phone, pointer away on desktop) collapses it and shows the new cell.
  if (phone) await page.touchscreen.tap(20, 200);
  else await page.mouse.move(700, 120);
  await expect(page.getByTestId("scout-zone")).toHaveAttribute("data-state", "collapsed");
  await expect(page.getByTestId("scout-frames").locator("li").first()).toBeVisible();
  await expect(page.getByText("Formaggi, Milano").first()).toBeVisible();
  expect(await noSideScroll(page)).toBe(true);
});

test("keyboard path: chip opens the flower, arrows move, Escape collapses", async ({ page }) => {
  await signIn(page);
  await page.goto("/?c=honey&t=bologna");
  await expect(page.getByTestId("scout-frames").locator("li").first().getByRole("link")).toBeVisible(); // hydrated
  await page.getByTestId("scout-chip-category").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("scout-zone")).toHaveAttribute("data-state", "bloomed");
  const checked = page.getByRole("radio", { checked: true });
  await expect(checked).toBeFocused();
  const before = await checked.getAttribute("aria-label");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { checked: true })).not.toHaveAttribute("aria-label", before!);
  await expect(page.getByRole("radio", { checked: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("scout-zone")).toHaveAttribute("data-state", "collapsed");
  await expect(page.getByTestId("scout-chip-category")).toBeFocused();
});
