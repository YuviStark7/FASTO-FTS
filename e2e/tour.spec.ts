import { expect, test, type Locator, type Page } from "@playwright/test";
import { signIn } from "./helpers";

// The guided tour never starts by itself under automation: ?tour=1 starts it (as the Settings replay link does).
const STEPS = [
  { title: "Cambia pagina", target: '[data-tour="chip"]' },
  { title: "Scegli categoria e città", target: '[data-tour="chips"]' },
  { title: "Il verdetto e i gradi", target: '[data-tour="verdict"]' },
  { title: "La scheda della cella", target: '[data-tour="open-cell"]' },
  { title: "Opportunità", target: '[data-tour="mos"]' },
  { title: "Chiedi", target: '[data-tour="ask"]' },
  { title: "Il tuo spazio", target: '[data-tour="profile"]' },
];

const dialog = (page: Page) => page.getByRole("dialog");
const counter = (page: Page) => page.getByTestId("tour-counter");
const spotlight = (page: Page) => page.getByTestId("tour-spotlight");
const stored = (page: Page, userId: string) => page.evaluate((k) => window.localStorage.getItem(k), `fasto.tour.v1:${userId}`);
const overflow = async (page: Page) => (await page.evaluate(() => document.documentElement.scrollWidth)) - page.viewportSize()!.width;
const focusInDialog = (page: Page) => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));

/** The spotlight has settled over the target: its box contains the target's box. */
async function expectSpotOver(page: Page, target: Locator) {
  await expect(spotlight(page)).toHaveAttribute("data-target", "true");
  await expect(async () => {
    const s = (await spotlight(page).boundingBox())!;
    const t = (await target.boundingBox())!;
    expect(t.width).toBeGreaterThan(0);
    expect(s.x, "left").toBeLessThanOrEqual(t.x + 1);
    expect(s.y, "top").toBeLessThanOrEqual(t.y + 1);
    expect(s.x + s.width, "right").toBeGreaterThanOrEqual(t.x + t.width - 1);
    expect(s.y + s.height, "bottom").toBeGreaterThanOrEqual(t.y + t.height - 1);
    // A spotlight, not the whole screen.
    expect(s.width * s.height).toBeLessThan(0.6 * page.viewportSize()!.width * page.viewportSize()!.height);
  }).toPass({ timeout: 4000 });
}

/** The card is fully inside the viewport and does not cover the element it explains. */
async function expectCardPlaced(page: Page, target: Locator) {
  await expect(async () => {
    const { width, height } = page.viewportSize()!;
    const c = (await dialog(page).boundingBox())!;
    const t = (await target.boundingBox())!;
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.y).toBeGreaterThanOrEqual(0);
    expect(c.x + c.width).toBeLessThanOrEqual(width + 0.5);
    expect(c.y + c.height).toBeLessThanOrEqual(height + 0.5);
    const apart = c.x >= t.x + t.width || c.x + c.width <= t.x || c.y >= t.y + t.height || c.y + c.height <= t.y;
    expect(apart, "card clear of the target").toBe(true);
  }).toPass({ timeout: 4000 });
}

async function startTour(page: Page, path = "/?tour=1") {
  await page.goto(path);
  await expect(dialog(page)).toBeVisible();
  await expect(counter(page)).toHaveText("1 / 7");
}

test("walks the seven steps, Back works, Fine stores done", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const { userId } = await signIn(page, "member", "tour");
  await startTour(page);
  // ?tour=1 is dropped once the tour is up, so a reload does not replay it.
  await expect(page).not.toHaveURL(/tour=1/);
  const nav = page.getByRole("navigation", { name: "Navigazione principale" });
  const phone = info.project.name === "phone-390";

  for (let i = 0; i < STEPS.length; i++) {
    const { title, target } = STEPS[i];
    await expect(counter(page)).toHaveText(`${i + 1} / 7`);
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page)).toHaveAccessibleName(title);
    await expect(dialog(page).getByRole("heading", { level: 2, name: title })).toBeVisible();
    await expect(dialog(page).getByRole("button", { name: "Salta il tour" })).toBeVisible();
    await expectSpotOver(page, page.locator(target));
    await expectCardPlaced(page, page.locator(target));
    expect(await overflow(page), `no side scroll on step ${i + 1}`).toBeLessThanOrEqual(0);

    if (i === 0) {
      // A click on the backdrop does nothing, and neither does one on the spotlighted chip.
      const { width, height } = page.viewportSize()!;
      await page.mouse.click(width - 6, phone ? height / 2 : height - 6);
      const chip = (await nav.boundingBox())!;
      await page.mouse.click(chip.x + chip.width / 2, chip.y + chip.height / 2);
      await expect(counter(page)).toHaveText("1 / 7");
      await expect(nav.getByRole("button")).toHaveAttribute("aria-expanded", "false");
      await expect(dialog(page).getByRole("button", { name: "Indietro" })).toHaveCount(0);
    }
    if (i === 2) {
      // Grades explained with the real badges, and the hatched swatch for insufficient data.
      const legend = page.getByTestId("tour-grades");
      await expect(legend.locator("abbr.grade")).toHaveText(["A", "B", "C"]);
      await expect(legend).toContainText("Dato misurato");
      await expect(legend).toContainText("Stima da modello");
      await expect(legend).toContainText("Segnale esplorativo");
      await expect(legend.locator(".hatched")).toBeVisible();
      await expect(dialog(page)).toContainText("mai un punteggio basso");
      // The spotlight also takes in the pills, where the MOS grade badge sits.
      await expectSpotOver(page, page.locator('[data-tour="pills"]'));
      await expectCardPlaced(page, page.locator('[data-tour="pills"]'));
      // Back, then forward again.
      await dialog(page).getByRole("button", { name: "Indietro" }).click();
      await expect(counter(page)).toHaveText("2 / 7");
      await expect(dialog(page)).toHaveAccessibleName(STEPS[1].title);
      await expectSpotOver(page, page.locator(STEPS[1].target));
      await dialog(page).getByRole("button", { name: "Avanti" }).click();
      await expect(counter(page)).toHaveText("3 / 7");
      await expectSpotOver(page, page.locator(target));
    }
    if (i === 3) {
      // The spotlighted pill is not a live link during the tour.
      const pill = (await page.locator(target).boundingBox())!;
      await page.mouse.click(pill.x + pill.width / 2, pill.y + pill.height / 2);
      await page.waitForTimeout(300);
      await expect(page).not.toHaveURL(/\/cell\//);
      await expect(counter(page)).toHaveText("4 / 7");
    }
    if (i === 5) await expect(nav.getByRole("button")).toHaveAttribute("aria-expanded", "true"); // held open for the Ask item
    if ([0, 2, 4, 6].includes(i)) {
      await page.waitForTimeout(500);
      await page.screenshot({ path: `test-results/tour-step${i + 1}-${info.project.name}.png` });
    }
    if (i < STEPS.length - 1) await dialog(page).getByRole("button", { name: "Avanti" }).click();
  }

  await expect(nav.getByRole("button")).toHaveAttribute("aria-expanded", "false"); // released after the Ask step
  await expect(dialog(page).getByRole("button", { name: "Avanti" })).toHaveCount(0);
  await dialog(page).getByRole("button", { name: "Fine" }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByTestId("tour")).toHaveCount(0);
  expect(await stored(page, userId)).toBe("done");

  // Reload without ?tour=1: nothing starts (automation never auto-starts) and the stored value stays.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(dialog(page)).toHaveCount(0);
  expect(await stored(page, userId)).toBe("done");
  // The page is interactive again.
  await page.getByRole("link", { name: "Apri la scheda", exact: true }).first().click();
  await expect(page).toHaveURL(/\/cell\//);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("keyboard: focus inside the dialog, arrows move, Tab cycles, Escape skips and focus returns", async ({ page }) => {
  // Put focus on the category chip before the tour starts, to see it come back at the end.
  await page.addInitScript(() => {
    const id = setInterval(() => {
      if (document.querySelector('[role="dialog"]')) return clearInterval(id);
      const el = document.querySelector<HTMLElement>('[data-testid="scout-chip-category"]');
      if (el && !el.closest("[hidden]")) {
        el.focus();
        if (document.activeElement === el) clearInterval(id);
      }
    }, 20);
  });
  const { userId } = await signIn(page, "member", "tour");
  await startTour(page);
  expect(await focusInDialog(page)).toBe(true);
  await expect(dialog(page)).toHaveAttribute("aria-modal", "true");
  await expect(dialog(page)).toHaveAccessibleDescription(/Scout, Mappa, Matrice e Chiedi/);
  await expect(page.getByTestId("tour-backdrop")).toHaveAttribute("aria-hidden", "true");
  await expect(spotlight(page)).toHaveAttribute("aria-hidden", "true");

  await page.keyboard.press("ArrowRight");
  await expect(counter(page)).toHaveText("2 / 7");
  await page.keyboard.press("ArrowRight");
  await expect(counter(page)).toHaveText("3 / 7");
  await page.keyboard.press("ArrowLeft");
  await expect(counter(page)).toHaveText("2 / 7");
  expect(await focusInDialog(page)).toBe(true);

  // Tab and Shift+Tab never leave the card: Skip, Back, Next and round again.
  const seen = new Set<string>();
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press("Tab");
    expect(await focusInDialog(page), `Tab ${i + 1}`).toBe(true);
    seen.add(await page.evaluate(() => document.activeElement?.textContent ?? ""));
  }
  expect([...seen].sort()).toEqual(["Avanti", "Indietro", "Salta il tour"]);
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Shift+Tab");
    expect(await focusInDialog(page), `Shift+Tab ${i + 1}`).toBe(true);
  }
  // Enter on a focused button works as usual.
  await dialog(page).getByRole("button", { name: "Avanti" }).focus();
  await page.keyboard.press("Enter");
  await expect(counter(page)).toHaveText("3 / 7");
  // Back to the first step with focus on Back: the button goes away, focus stays in the dialog.
  await dialog(page).getByRole("button", { name: "Indietro" }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(counter(page)).toHaveText("1 / 7");
  expect(await focusInDialog(page)).toBe(true);

  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  expect(await stored(page, userId)).toBe("skipped");
  await expect(page.getByTestId("scout-chip-category")).toBeFocused();
  // Escape went to the tour only: the flower did not react.
  await expect(page.getByTestId("scout-zone")).toHaveAttribute("data-state", "collapsed");
});

test("Skip button stores skipped; Settings replays the tour whatever is stored, in English too", async ({ page }, info) => {
  const { userId } = await signIn(page, "member", "tour");
  await startTour(page);
  await dialog(page).getByRole("button", { name: "Salta il tour" }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(await stored(page, userId)).toBe("skipped");

  // Settings is reachable from the profile menu.
  const badge = page.getByRole("button", { name: "Profilo e impostazioni" });
  await expect(async () => {
    if ((await badge.getAttribute("aria-expanded")) !== "true") await badge.click();
    await expect(page.getByRole("menuitem", { name: "Impostazioni" })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10_000 });
  await page.getByRole("menuitem", { name: "Impostazioni" }).click();
  await expect(page).toHaveURL(/\/more$/);

  const replay = page.getByRole("link", { name: "Ripeti il tour" });
  await expect(replay).toHaveAttribute("href", "/?tour=1");
  expect((await replay.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `test-results/tour-settings-${info.project.name}.png`, fullPage: true });
  await replay.click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).toHaveAccessibleName("Cambia pagina");
  await expect(page).toHaveURL((u) => u.pathname === "/" && !u.searchParams.has("tour"));
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);

  await page.goto("/en/more");
  const replayEn = page.getByRole("link", { name: "Replay the tour" });
  await expect(replayEn).toHaveAttribute("href", "/en?tour=1");
  await replayEn.click();
  await expect(dialog(page)).toHaveAccessibleName("Switch page");
  await expect(counter(page)).toHaveText("1 / 7");
  await expect(dialog(page).getByRole("button", { name: "Skip the tour" })).toBeVisible();
  await dialog(page).getByRole("button", { name: "Next" }).click();
  await expect(dialog(page)).toHaveAccessibleName("Pick a category and a city");
  for (let i = 0; i < 5; i++) await dialog(page).getByRole("button", { name: "Next" }).click();
  await expect(dialog(page)).toHaveAccessibleName("Your space");
  await dialog(page).getByRole("button", { name: "Done" }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(await stored(page, userId)).toBe("done");
});

test("a step whose target is missing shows its card without a spotlight", async ({ page }, info) => {
  await signIn(page, "member", "tour");
  await startTour(page);
  await page.addStyleTag({ content: '[data-tour="mos"]{display:none!important}' });
  for (let i = 0; i < 4; i++) await dialog(page).getByRole("button", { name: "Avanti" }).click();
  await expect(counter(page)).toHaveText("5 / 7");
  await expect(dialog(page)).toHaveAccessibleName("Opportunità");
  await expect(spotlight(page)).toHaveAttribute("data-target", "false");
  const { width, height } = page.viewportSize()!;
  await expect(async () => {
    const s = (await spotlight(page).boundingBox())!;
    expect(s.width * s.height, "no cut-out").toBe(0);
    const c = (await dialog(page).boundingBox())!;
    expect(Math.abs(c.x + c.width / 2 - width / 2), "centred horizontally").toBeLessThanOrEqual(1);
    if (info.project.name === "phone-390") {
      // On a phone the card stays the bottom sheet.
      expect(c.width).toBe(width);
      expect(Math.abs(c.y + c.height - height)).toBeLessThanOrEqual(1);
    } else {
      expect(Math.abs(c.y + c.height / 2 - height / 2), "centred vertically").toBeLessThanOrEqual(1);
    }
  }).toPass({ timeout: 4000 });
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/tour-missing-target-${info.project.name}.png` });
  // The tour goes on.
  await dialog(page).getByRole("button", { name: "Avanti" }).click();
  await expect(counter(page)).toHaveText("6 / 7");
  await expectSpotOver(page, page.locator('[data-tour="ask"]'));
});

test("layout: bottom sheet on phones, beside the target on desktop, follows a resize", async ({ page }, info) => {
  await signIn(page, "member", "tour");
  await startTour(page);
  const { width, height } = page.viewportSize()!;
  if (info.project.name === "phone-390") {
    const c = (await dialog(page).boundingBox())!;
    expect(c.x).toBe(0);
    expect(c.width).toBe(width);
    expect(Math.abs(c.y + c.height - height), "docked at the bottom").toBeLessThanOrEqual(1);
    // Step 2 points at the chips at the bottom of the screen: the sheet moves to the top edge instead of covering them.
    await dialog(page).getByRole("button", { name: "Avanti" }).click();
    await expectSpotOver(page, page.locator('[data-tour="chips"]'));
    await expectCardPlaced(page, page.locator('[data-tour="chips"]'));
    await expect(dialog(page)).toHaveAttribute("data-dock", "top");
  } else {
    await expect(dialog(page)).toHaveAttribute("data-dock", "float");
    expect((await dialog(page).boundingBox())!.width).toBeLessThanOrEqual(360);
    // The chip is centred: after a resize the spotlight and the card are over its new position.
    await page.setViewportSize({ width: 1024, height: 700 });
    await expectSpotOver(page, page.locator('[data-tour="chip"]'));
    await expectCardPlaced(page, page.locator('[data-tour="chip"]'));
    await page.setViewportSize({ width: 500, height: 700 });
    await expect(dialog(page)).toHaveAttribute("data-dock", "bottom");
    await expectSpotOver(page, page.locator('[data-tour="chip"]'));
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  }
});

test("light theme: the tour runs and keeps its spotlight", async ({ page, context }, info) => {
  await signIn(page, "member", "tour");
  await context.addCookies([{ name: "theme", value: "light", url: new URL(page.url()).origin }]);
  await startTour(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await dialog(page).getByRole("button", { name: "Avanti" }).click();
  await dialog(page).getByRole("button", { name: "Avanti" }).click();
  await expectSpotOver(page, page.locator('[data-tour="verdict"]'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test-results/tour-step3-light-${info.project.name}.png` });
});

test("reduced motion: the tour still runs, without transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { userId } = await signIn(page, "member", "tour");
  await startTour(page);
  for (let i = 0; i < STEPS.length; i++) {
    await expect(counter(page)).toHaveText(`${i + 1} / 7`);
    // Instant: no transition or animation on the spotlight or the card, even right after a step change.
    const motion = await page.evaluate(() =>
      ["tour-spotlight", "tour-card"].map((id) => {
        const s = getComputedStyle(document.querySelector(`[data-testid="${id}"]`)!);
        return `${s.transitionProperty}/${s.animationName}`;
      }),
    );
    expect(motion).toEqual(["none/none", "none/none"]);
    await expectSpotOver(page, page.locator(STEPS[i].target));
    await dialog(page).getByRole("button", { name: i < STEPS.length - 1 ? "Avanti" : "Fine" }).click();
  }
  await expect(dialog(page)).toHaveCount(0);
  expect(await stored(page, userId)).toBe("done");
});

test("a real first visit: starts by itself after the Scout intro, once; never on other routes", async ({ page }) => {
  // Look like a person's browser: the intro plays and the tour may start on its own.
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false });
    const w = window as unknown as { __tour: { introSeen: boolean; duringIntro: boolean | null } };
    w.__tour = { introSeen: false, duringIntro: null };
    new MutationObserver(() => {
      const intro = document.documentElement.hasAttribute("data-scout-intro");
      if (intro) w.__tour.introSeen = true;
      if (w.__tour.duringIntro === null && document.querySelector('[data-testid="tour"]')) w.__tour.duringIntro = intro;
    }).observe(document, { attributes: true, childList: true, subtree: true, attributeFilter: ["data-scout-intro"] });
  });
  const { userId } = await signIn(page, "member", "tour");
  const introGone = () => page.waitForFunction(() => !document.documentElement.hasAttribute("data-scout-intro"));

  // Another route first: no tour there.
  await page.goto("/matrix");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);
  await expect(dialog(page)).toHaveCount(0);

  await page.goto("/");
  await expect(dialog(page)).toBeVisible({ timeout: 8000 });
  const probe = await page.evaluate(() => (window as unknown as { __tour: { introSeen: boolean; duringIntro: boolean | null } }).__tour);
  expect(probe.introSeen, "the intro played").toBe(true);
  expect(probe.duringIntro, "the tour waited for the intro to end").toBe(false);
  expect(await focusInDialog(page)).toBe(true);
  await expectSpotOver(page, page.locator('[data-tour="chip"]'));
  for (let i = 0; i < 6; i++) await dialog(page).getByRole("button", { name: "Avanti" }).click();
  await dialog(page).getByRole("button", { name: "Fine" }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(await stored(page, userId)).toBe("done");

  // Second visit: the intro plays again, the tour does not.
  await page.reload();
  await introGone();
  await page.waitForTimeout(1500);
  await expect(dialog(page)).toHaveCount(0);

  // Storage that refuses writes: skipped once, and not started again by a client navigation back to Scout.
  await page.evaluate((k) => window.localStorage.removeItem(k), `fasto.tour.v1:${userId}`);
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
  });
  await page.reload();
  await expect(dialog(page)).toBeVisible({ timeout: 8000 });
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  expect(await stored(page, userId)).toBeNull();
  const nav = page.getByRole("navigation", { name: "Navigazione principale" });
  await nav.getByRole("button").click();
  await nav.getByRole("link", { name: "Matrice" }).click();
  await expect(page).toHaveURL(/\/matrix/);
  await nav.getByRole("button").click();
  await nav.getByRole("link", { name: "Scout" }).click();
  await expect(page).toHaveURL((u) => u.pathname === "/");
  await page.waitForTimeout(1500);
  await expect(dialog(page)).toHaveCount(0);
});
