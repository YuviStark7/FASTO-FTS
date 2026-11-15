import { test, expect, type Page } from "@playwright/test";
import { signIn } from "./helpers";

// A minimal base style stands in for the tile server (not reachable from CI or the sandbox), so
// the map itself is created and drawn. Regression: MapLibre's own .maplibregl-map class overrode
// the container's `absolute inset-0`, the container collapsed and the card stayed empty.
const STYLE = JSON.stringify({ version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#224466" } }] });

async function expectDrawnMap(page: Page) {
  const card = page.getByRole("region", { name: /mappa/i }).or(page.locator(".card.relative").filter({ has: page.locator(".maplibregl-canvas") })).first();
  const canvas = page.locator("canvas.maplibregl-canvas");
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".maplibregl-marker")).toHaveCount(20);
  const [c, k] = await Promise.all([canvas.boundingBox(), card.boundingBox()]);
  expect(c!.height, "the canvas fills the card's height").toBeGreaterThan(k!.height * 0.9);
}

test.beforeEach(async ({ page }) => {
  await page.context().route("https://tiles.openfreemap.org/**", (r) => r.fulfill({ contentType: "application/json", body: STYLE }));
});

test("the map is drawn at full size on a direct load", async ({ page }) => {
  await signIn(page);
  await page.goto("/map");
  await expectDrawnMap(page);
});

test("the map is drawn when opened from the header chip", async ({ page }) => {
  await signIn(page);
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Navigazione principale" });
  await expect(async () => {
    await nav.getByRole("button").click();
    await expect(nav.getByRole("link", { name: "Mappa" })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10_000 });
  await nav.getByRole("link", { name: "Mappa" }).click();
  await expect(page).toHaveURL(/\/map/);
  await expectDrawnMap(page);
  // The chip now shows Map as the current page, and the profile menu no longer lists it.
  await expect(nav.getByRole("button")).toHaveAccessibleName(/Pagina attuale: Mappa/);
  await page.getByRole("button", { name: "Profilo e impostazioni" }).click();
  await expect(page.getByRole("menuitem", { name: /Mappa/ })).toHaveCount(0);
});
