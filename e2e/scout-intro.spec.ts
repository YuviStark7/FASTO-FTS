import { test, expect, type Page } from "@playwright/test";
import { signIn } from "./helpers";

// The intro never plays under automation unless the URL asks for it with ?intro=1.
const FRAMES = [300, 900, 1500, 2000, 2600];

type Probe = { play: number | null; end: number | null; states: (string | null)[] };

/** Records every change of <html data-scout-intro> with its time, from before the page's own scripts run. */
async function probe(page: Page) {
  await page.addInitScript(() => {
    const p: Probe = { play: null, end: null, states: [] };
    (window as unknown as { __intro: Probe }).__intro = p;
    new MutationObserver(() => {
      const s = document.documentElement?.getAttribute("data-scout-intro") ?? null;
      if (s === p.states[p.states.length - 1]) return;
      p.states.push(s);
      if (s === "play") p.play = performance.now();
      if (s === null && p.states.length > 1) p.end = performance.now();
    }).observe(document, { attributes: true, subtree: true, attributeFilter: ["data-scout-intro"] });
  });
}
const read = (page: Page) => page.evaluate(() => (window as unknown as { __intro: Probe }).__intro);
/** Resolves once the choreography has been running for `ms`. */
const at = (page: Page, ms: number) =>
  page.waitForFunction(
    (ms) => {
      const p = (window as unknown as { __intro?: Probe }).__intro;
      return p?.play != null && performance.now() - p.play >= ms;
    },
    ms,
    { polling: "raf" },
  );

const parts = (page: Page) => ({
  heading: page.getByRole("heading", { level: 1 }),
  chip: page.getByRole("navigation", { name: "Navigazione principale" }),
  badge: page.getByRole("button", { name: "Profilo e impostazioni" }),
  chips: page.getByTestId("scout-chip-category"),
});
async function boxes(page: Page) {
  const out: Record<string, { x: number; y: number; width: number; height: number }> = {};
  for (const [k, l] of Object.entries(parts(page))) {
    await expect(l).toBeVisible();
    out[k] = (await l.boundingBox())!;
  }
  return out;
}

test("first visit: the intro plays once, ends within 3.2 s and leaves the normal Scout", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await probe(page);
  await signIn(page);

  // Reference: the same page without the intro (automation, no ?intro=1).
  await page.goto("/");
  await expect(page.getByTestId("scout-intro")).toBeHidden();
  await page.waitForTimeout(900);
  const reference = await boxes(page);
  expect((await read(page)).states, "no intro under automation").toEqual([]);

  await page.goto("/?intro=1", { waitUntil: "commit" });
  const overlay = page.getByTestId("scout-intro");
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByTestId("scout-intro-flower")).toHaveAttribute("aria-hidden", "true");
  for (const ms of FRAMES) {
    await at(page, ms);
    await page.screenshot({ path: `test-results/scout-intro-${info.project.name}-${ms}ms.png` });
    if (ms === 900) {
      // Mid-intro: the real Scout is already in the document, for assistive tech and for hydration.
      await expect(page.getByTestId("scout-intro-flower").locator(".scout-intro-petal")).toHaveCount(15);
      await expect(page.getByTestId("scout-zone")).toHaveAttribute("data-state", "collapsed");
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    }
  }

  await expect(overlay).toBeHidden();
  const p = await read(page);
  expect(p.states).toEqual(["pending", "play", null]);
  expect(p.end! - p.play!, "length of the intro").toBeLessThanOrEqual(3200);
  expect(p.end! - p.play!).toBeGreaterThanOrEqual(2000);

  // Same positions and sizes as without the intro; focus was not taken.
  const after = await boxes(page);
  for (const [k, ref] of Object.entries(reference)) {
    for (const d of ["x", "y", "width", "height"] as const) {
      expect(Math.abs(after[k][d] - ref[d]), `${k}.${d}`).toBeLessThanOrEqual(1);
    }
  }
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  expect(errors, "no script or hydration errors").toEqual([]);

  // The page is usable straight away.
  await parts(page).badge.click();
  await expect(page.getByRole("menu")).toBeVisible();

  // Every reload plays it again.
  await page.reload({ waitUntil: "commit" });
  await expect(overlay).toBeVisible();
  await expect(overlay).toBeHidden({ timeout: 4000 });
  expect((await read(page)).states).toEqual(["pending", "play", null]);
});

test("a tap or click during the intro ends it at once, and only that", async ({ page }, info) => {
  const phone = info.project.name.startsWith("phone");
  await probe(page);
  await signIn(page);
  await page.goto("/en?intro=1", { waitUntil: "commit" });
  await at(page, 500);
  const url = page.url();
  // Aim at the "open the sheet" pill under the overlay: the press must skip the intro, not follow the link.
  const pill = (await page.getByRole("link", { name: "Open the sheet", exact: true }).first().boundingBox())!;
  const x = pill.x + pill.width / 2;
  const y = pill.y + pill.height / 2;
  if (phone) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await expect(page.getByTestId("scout-intro")).toBeHidden({ timeout: 250 });
  const p = await read(page);
  expect(p.states).toEqual(["pending", "play", null]);
  expect(p.end! - p.play!).toBeLessThan(1500);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator('[data-intro-part="badge"] button[aria-haspopup="menu"]')).toBeVisible();
  await expect(page.locator('[data-intro-part="chip"]')).toBeVisible();
  await page.waitForTimeout(300);
  expect(new URL(page.url()).pathname).toBe(new URL(url).pathname);
  await page.screenshot({ path: `test-results/scout-intro-${info.project.name}-skipped.png` });
});

test("a key press during the intro ends it at once", async ({ page }) => {
  await probe(page);
  await signIn(page);
  await page.goto("/?intro=1", { waitUntil: "commit" });
  await at(page, 400);
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("scout-intro")).toBeHidden({ timeout: 250 });
  const p = await read(page);
  expect(p.end! - p.play!).toBeLessThan(1500);
});

test("moving around the app and back to Scout does not replay it", async ({ page }) => {
  await probe(page);
  await signIn(page);
  await page.goto("/?intro=1");
  await expect(page.getByTestId("scout-intro")).toBeHidden({ timeout: 4000 });
  const nav = page.getByRole("navigation", { name: "Navigazione principale" });
  await nav.getByRole("button").click();
  await nav.getByRole("link", { name: "Matrice" }).click();
  await expect(page).toHaveURL(/\/matrix/);
  await nav.getByRole("button").click();
  await nav.getByRole("link", { name: "Scout" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(400);
  // Same document: the intro ran once on the full load, and the client navigation back added nothing.
  expect((await read(page)).states).toEqual(["pending", "play", null]);
  await expect(page.getByTestId("scout-intro")).toBeHidden();
});

test("no intro on other routes", async ({ page }) => {
  await probe(page);
  await signIn(page);
  await page.goto("/matrix?intro=1");
  await page.waitForTimeout(400);
  expect((await read(page)).states).toEqual([]);
  // A client navigation back to Scout does not play it either.
  await page.getByRole("navigation", { name: "Navigazione principale" }).getByRole("button").click();
  await page.getByRole("navigation", { name: "Navigazione principale" }).getByRole("link", { name: "Scout" }).click();
  await expect(page.getByTestId("scout-zone")).toBeVisible();
  await page.waitForTimeout(400);
  expect((await read(page)).states).toEqual([]);
  await expect(page.getByTestId("scout-intro")).toBeHidden();
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("no intro at all", async ({ page }) => {
    await probe(page);
    await signIn(page);
    await page.goto("/?intro=1");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(400);
    expect((await read(page)).states).toEqual([]);
    await expect(page.getByTestId("scout-intro")).toBeHidden();
  });
});

test("light theme frames", async ({ page, context, baseURL }, info) => {
  await probe(page);
  await signIn(page);
  await context.addCookies([{ name: "theme", value: "light", url: baseURL! }]);
  await page.goto("/?intro=1", { waitUntil: "commit" });
  for (const ms of [900, 1500, 2000]) {
    await at(page, ms);
    await page.screenshot({ path: `test-results/scout-intro-light-${info.project.name}-${ms}ms.png` });
  }
  await expect(page.getByTestId("scout-intro")).toBeHidden({ timeout: 2000 });
});
