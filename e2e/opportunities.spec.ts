import { test, expect, type Page } from "@playwright/test";
import { admin, signIn } from "./helpers";
import { seedDemoMos } from "./mos-demo";
import { parseMosComponents, toCellComponents } from "../lib/queries/mos-shape";
import { scoreMos, type Weights } from "../lib/scoring/mos";

const SCREENS = "e2e/__screens__";
const SIZE_ONLY: Weights = { growth: 0, size: 1, csi: 0, pressure: 0, fit: 0 };
const one = new Intl.NumberFormat("it", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

type Snap = { category: string; territory: string; mos: number | null; isPartial: boolean; isDemo: boolean; components: unknown };

/** The cells with a MOS snapshot, as the database has them. Tests never assume what the data says. */
async function snapshots(): Promise<Snap[]> {
  const read = () =>
    admin.from("cells").select("categories(slug), territories(slug), mos_snapshots(mos, is_partial, is_demo, components)").not("mos_snapshot_id", "is", null);
  let { data, error } = await read();
  if (error) ({ data, error } = await read()); // the local stack can drop a request under parallel load
  if (error) throw new Error(`snapshots: ${error.message || JSON.stringify(error)}`);
  type Row = { categories: { slug: string }; territories: { slug: string }; mos_snapshots: { mos: number | null; is_partial: boolean; is_demo: boolean; components: unknown } };
  return (data as unknown as Row[]).map((r) => ({
    category: r.categories.slug,
    territory: r.territories.slug,
    mos: r.mos_snapshots.mos == null ? null : Number(r.mos_snapshots.mos),
    isPartial: r.mos_snapshots.is_partial,
    isDemo: r.mos_snapshots.is_demo,
    components: r.mos_snapshots.components,
  }));
}

async function setWeight(page: Page, name: string, value: number) {
  await page.getByRole("slider", { name: `Peso di ${name}` }).fill(String(value));
}

async function openWeights(page: Page, phone: boolean) {
  if (phone) await page.getByRole("button", { name: "Apri i pesi" }).tap();
  await expect(page.getByRole("slider", { name: "Peso di Crescita" })).toBeVisible();
}

test.beforeAll(async () => {
  await seedDemoMos();
});

test("Opportunities ranks cells with grades; a weight change re-ranks without a server call", async ({ page }, info) => {
  const phone = info.project.name.startsWith("phone");
  const snaps = await snapshots();
  const scored = snaps.filter((s) => s.mos != null);
  expect(scored.length).toBeGreaterThan(1);

  await signIn(page);
  await page.goto("/opportunities");
  await expect(page.getByRole("heading", { level: 1, name: "Opportunità" })).toBeVisible();

  // Ranked rows: every MOS has its grade beside it and says whether it is partial, with its coverage.
  const rows = page.getByTestId("opp-row");
  const shown = Math.min(30, scored.length);
  await expect(rows).toHaveCount(shown);
  for (let i = 0; i < Math.min(shown, 8); i++) {
    const row = rows.nth(i);
    await expect(row.getByTestId("opp-mos").locator("abbr.grade")).toHaveText(/^[BC]$/);
    await expect(row.getByTestId("opp-coverage")).toHaveText(/(Parziale|Completo).*copertura \d+/);
    await expect(row.getByRole("img", { name: /Punti per componente/ })).toBeVisible();
  }
  // Stored order under the default weights: highest MOS first.
  const storedTop = [...scored].sort((a, b) => b.mos! - a.mos!).slice(0, shown).map((s) => one.format(s.mos!));
  await expect(rows.getByTestId("opp-mos").locator(".t-figure")).toHaveText(storedTop);
  await expect(page.getByTestId("whatif-badge")).toHaveCount(0);

  // Cells without a MOS are listed apart as insufficient, never ranked and never a zero.
  const unscored = snaps.filter((s) => s.mos == null);
  if (unscored.length) {
    const section = page.getByTestId("opp-insufficient");
    await expect(section.getByRole("heading", { name: "Dati insufficienti" })).toBeVisible();
    await expect(section.getByText(/Manca: (Crescita|Dimensione)/).first()).toBeVisible();
    await expect(section.locator("abbr.grade")).toHaveCount(0);
  }
  if (snaps.some((s) => s.isDemo)) await expect(page.locator(".demo").first()).toBeVisible();
  expect(await noSideScroll(page)).toBe(true);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SCREENS}/opportunities-${info.project.name}.png`, fullPage: true });

  // What-if: all the weight on Size. The browser re-ranks with scoreMos; the server hears nothing.
  const before = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-key")));
  await openWeights(page, phone);
  await page.waitForLoadState("networkidle");
  const requests: string[] = [];
  page.on("request", (r) => requests.push(`${r.method()} ${r.url()}`));
  for (const [name, value] of [["Crescita", 0], ["CSI", 0], ["Pressione", 0], ["Fit", 0], ["Dimensione", 100]] as const) await setWeight(page, name, value);

  await expect(page.getByTestId("whatif-badge")).toBeVisible();
  await expect(page.getByTestId("weight-size")).toHaveText("100%");
  const expected = snaps
    .map((s) => scoreMos(toCellComponents(parseMosComponents(s.components)), SIZE_ONLY).mos)
    .filter((m): m is number => m != null)
    .sort((a, b) => b - a)
    .slice(0, 30)
    .map((m) => one.format(m));
  await expect(rows.getByTestId("opp-mos").locator(".t-figure")).toHaveText(expected);
  await expect(rows.first().getByTestId("opp-mos").locator("abbr.grade")).toHaveText(/^[BC]$/);
  const after = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-key")));
  expect(after).not.toEqual(before);
  await page.waitForTimeout(600);
  expect(requests, "moving the weights must not call the server").toEqual([]);
  await page.screenshot({ path: `${SCREENS}/opportunities-whatif-${info.project.name}.png` });

  // Back to the default weights: the stored ranking again.
  await page.getByRole("button", { name: "Predefiniti (SPEC)" }).click();
  await expect(page.getByTestId("whatif-badge")).toHaveCount(0);
  await expect(rows.getByTestId("opp-mos").locator(".t-figure")).toHaveText(storedTop);
  expect(requests).toEqual([]);
});

test("filters narrow the ranking by category and country", async ({ page }) => {
  const snaps = (await snapshots()).filter((s) => s.mos != null);
  const target = snaps[0];
  await signIn(page);
  await page.goto("/opportunities");
  const rows = page.getByTestId("opp-row");
  await expect(rows.first()).toBeVisible();
  await page.getByLabel("Categoria").selectOption(target.category);
  const inCategory = snaps.filter((s) => s.category === target.category).length;
  await expect(rows).toHaveCount(Math.min(30, inCategory));
  const keys = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-key") ?? ""));
  expect(keys.every((k) => k.startsWith(`${target.category}:`))).toBe(true);
  await page.getByRole("button", { name: "Azzera i filtri" }).click();
  await expect(rows).toHaveCount(Math.min(30, snaps.length));
});

test("a weight set is saved for the organisation and can be applied again; a viewer cannot save", async ({ page, browser }, info) => {
  const phone = info.project.name.startsWith("phone");
  const { userId } = await signIn(page);
  await page.goto("/opportunities");
  await expect(page.getByTestId("opp-row").first()).toBeVisible();
  await openWeights(page, phone);
  await setWeight(page, "Dimensione", 60);
  const name = `Prova ${Date.now()}`;
  await page.getByRole("textbox", { name: "Nome dell'insieme" }).fill(name);
  await page.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(page.getByText(`Insieme salvato: ${name}`)).toBeVisible();

  // Stored for the user's own organisation, with weights that sum to 1.
  const { data: mem } = await admin.from("memberships").select("org_id").eq("user_id", userId).single();
  const { data: saved } = await admin.from("weight_sets").select("org_id, weights, created_by").eq("name", name).single();
  expect(saved?.org_id).toBe(mem?.org_id);
  expect(saved?.created_by).toBe(userId);
  const sum = Object.values(saved!.weights as Record<string, number>).reduce((a, b) => a + b, 0);
  expect(Math.abs(sum - 1)).toBeLessThan(1e-4);

  // After a reload the set is in the select; choosing it brings the what-if ranking back.
  await page.reload();
  await openWeights(page, phone);
  const select = page.getByLabel("Insieme di pesi");
  await expect(select).toHaveValue("default");
  await select.selectOption({ label: name });
  await expect(page.getByTestId("whatif-badge")).toBeVisible();

  // A viewer can try weights but is not offered the save form.
  const ctx = await browser.newContext({ viewport: info.project.use.viewport!, isMobile: info.project.use.isMobile, hasTouch: info.project.use.hasTouch, baseURL: info.project.use.baseURL });
  const viewer = await ctx.newPage();
  await signIn(viewer, "viewer");
  await viewer.goto("/opportunities");
  await expect(viewer.getByTestId("opp-row").first()).toBeVisible();
  await openWeights(viewer, phone);
  await expect(viewer.getByText("Il tuo ruolo può provare i pesi, ma non salvarli.")).toBeVisible();
  await expect(viewer.getByRole("button", { name: "Salva", exact: true })).toHaveCount(0);
  await ctx.close();
});

test("Opportunity tab shows the MOS with grade, partial label and component breakdown", async ({ page }, info) => {
  const snaps = await snapshots();
  const cell = snaps.find((s) => s.mos != null && s.isPartial) ?? snaps.find((s) => s.mos != null)!;
  await signIn(page);
  await page.goto(`/cell/${cell.category}/${cell.territory}?tab=opportunity`);
  await expect(page.getByRole("tab", { name: "Opportunità" })).toHaveAttribute("aria-selected", "true");

  const figure = page.getByTestId("mos-figure");
  const open = figure.getByRole("button", { name: /^Dettaglio del dato/ });
  await expect(open.locator(".t-figure")).toHaveText(one.format(cell.mos!));
  await expect(open.locator("abbr.grade")).toHaveText(/^[BC]$/);
  if (cell.isDemo) await expect(figure.locator(".demo")).toBeVisible();
  await expect(page.getByTestId("mos-coverage")).toHaveText(new RegExp(`${cell.isPartial ? "Parziale" : "Completo"}.*copertura \\d+`));

  // Five components. A present one has a graded figure and its points; a missing one says so, never 0.
  const items = page.getByTestId("mos-components").locator("> li");
  await expect(items).toHaveCount(5);
  const parsed = parseMosComponents(cell.components);
  for (const key of ["growth", "size", "csi", "pressure", "fit"] as const) {
    const item = page.locator(`[data-component="${key}"]`);
    if (parsed[key].present) {
      await expect(item.locator("abbr.grade").first()).toBeVisible();
      await expect(item.getByText(/punti$/)).toBeVisible();
      await expect(item.getByText(/^percentile \d/).first()).toBeVisible();
    } else {
      await expect(item.getByText("Non disponibile", { exact: true })).toBeVisible();
      await expect(item.locator("abbr.grade")).toHaveCount(0);
    }
  }
  await expect(page.locator('[data-component="fit"]').getByText(/passaporto di prodotto/)).toBeVisible();
  await expect(page.getByText("La nota di ingresso arriva più tardi oggi.")).toBeVisible();
  expect(await noSideScroll(page)).toBe(true);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SCREENS}/opportunity-tab-${info.project.name}.png`, fullPage: true });

  // The MOS opens its evidence like any other figure: grade, date and method version.
  await open.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("mos-v1")).toBeVisible();
  await expect(dialog.getByText(/^[BC]: /)).toBeVisible();
  await dialog.getByRole("button", { name: "Chiudi" }).click();

  await page.getByRole("link", { name: "Vedi la classifica delle opportunità" }).click();
  await expect(page).toHaveURL(/\/opportunities$/);
  await expect(page.getByRole("heading", { level: 1, name: "Opportunità" })).toBeVisible();
});

test("a cell without a MOS shows the insufficient state, not a number", async ({ page }, info) => {
  const snaps = await snapshots();
  const cell = snaps.find((s) => s.mos == null);
  test.skip(!cell, "every snapshot in this database has a MOS");
  await signIn(page);
  await page.goto(`/cell/${cell!.category}/${cell!.territory}?tab=opportunity`);
  const state = page.getByTestId("mos-insufficient");
  await expect(state.getByText("MOS non disponibile")).toBeVisible();
  await expect(state.getByText(/Manca: (Crescita|Dimensione)/)).toBeVisible();
  await expect(state.locator(".hatched")).toBeVisible();
  await expect(page.getByTestId("mos-figure")).toHaveCount(0);
  await expect(page.getByTestId("mos-coverage")).toHaveCount(0);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SCREENS}/opportunity-tab-insufficient-${info.project.name}.png`, fullPage: true });
});

test("MOS carries its grade on Scout and in the matrix, and Opportunities is one tap from MOS mode", async ({ page }) => {
  const cell = (await snapshots()).find((s) => s.mos != null)!;
  await signIn(page);
  await page.goto(`/?c=${cell.category}&t=${cell.territory}`);
  const pill = page.getByRole("link", { name: /^MOS \d+/ });
  await expect(pill.locator("abbr.grade")).toHaveText(/^[BC]$/);
  if (cell.isPartial) await expect(pill).toContainText("parziale");
  await pill.click();
  await expect(page).toHaveURL(/\/matrix\?mode=mos/);

  const current = page.locator("[data-matrix-target]:visible");
  await expect(current).toHaveAttribute("aria-label", new RegExp(`MOS ${Math.round(cell.mos!)}${cell.isPartial ? " parziale" : ""}, grado [BC]`));
  await expect(current.locator("abbr.grade")).toHaveText(/^[BC]$/);

  await page.getByTestId("to-opportunities").click();
  await expect(page).toHaveURL(/\/opportunities$/);
  await expect(page.getByTestId("opp-row").first()).toBeVisible();
});
