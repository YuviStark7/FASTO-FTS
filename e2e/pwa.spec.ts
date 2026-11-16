import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("the manifest and icons make the app installable", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m).toMatchObject({ short_name: "FASTO FTS", start_url: "/", display: "standalone", id: "/" });
  const sizes = m.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}:${i.purpose}`);
  expect(sizes).toEqual(expect.arrayContaining(["192x192:any", "512x512:any", "512x512:maskable"]));
  for (const i of m.icons as { src: string }[]) {
    const icon = await request.get(i.src);
    expect(icon.ok(), i.src).toBe(true);
    expect(icon.headers()["content-type"]).toContain("image/png");
  }
  for (const path of ["/sw.js", "/offline.html", "/icons/apple-touch-icon.png"]) expect((await request.get(path)).ok(), path).toBe(true);
});

test("the page links the manifest and the Apple icon", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /apple-touch-icon\.png/);
});

test("the service worker controls the app and shows the offline page without a network", async ({ page, context }) => {
  await signIn(page);
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // The first load registered it; a reload puts the page under its control.
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.goto("/matrix").catch(() => {});
  await expect(page.getByRole("heading", { name: "Sei offline" })).toBeVisible();
  await context.setOffline(false);
});

test("settings offer the install control", async ({ page }) => {
  await signIn(page);
  await page.goto("/more");
  // Headless Chromium fires no install prompt, so it explains instead; the section is there either way.
  await expect(page.getByTestId("install-app")).toBeVisible();
  await expect(page.getByTestId("install-app")).toHaveAttribute("data-state", /available|unsupported|ios|installed/);
});
