import { test, expect, type Browser, type Page, type TestInfo } from "@playwright/test";
import { admin, signIn } from "./helpers";
import { seedDemoMos } from "./mos-demo";
import { FIT_CATEGORY, categoryOf, expectedFit, insertPassport, removeFitReadings, removePassports, seedFitReadings, type ExpectedFit } from "./passport-fixture";
import { LEVER_LABELS } from "../lib/ai/levers";
import { parseMosComponents, toCellComponents } from "../lib/queries/mos-shape";
import type { Passport } from "../lib/scoring/fit";
import { scoreMos, type Weights } from "../lib/scoring/mos";

const SCREENS = "e2e/__screens__";
const FIT_ONLY: Weights = { growth: 0, size: 0, csi: 0, pressure: 0, fit: 1 };
const one = new Intl.NumberFormat("it", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const share = new Intl.NumberFormat("it", { style: "percent", maximumFractionDigits: 1 });
const NO_READING = "Nessuna lettura pubblicata dei consumatori";
const NO_READING_CATEGORY = "chocolate";
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const isPhone = (info: TestInfo) => info.project.name.startsWith("phone");
const uniqueName = (what: string) => `${what} ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

let readings: number[] = [];
const passports: number[] = [];

test.beforeAll(async () => {
  await seedDemoMos();
  readings = await seedFitReadings();
});
test.afterAll(async () => {
  await removePassports(passports);
  await removeFitReadings(readings);
});

async function otherPage(browser: Browser, info: TestInfo) {
  const ctx = await browser.newContext({ viewport: info.project.use.viewport!, isMobile: info.project.use.isMobile, hasTouch: info.project.use.hasTouch, baseURL: info.project.use.baseURL });
  return { ctx, page: await ctx.newPage() };
}

/** The Fit table against what fit-v1 gives for the database as it is. A city without a reading is hatched, never a zero. */
async function expectFitTable(page: Page, expected: ExpectedFit) {
  const table = page.getByTestId("fit-table");
  await expect(table.locator("tbody tr")).toHaveCount(expected.cities.length);
  expect(expected.cities.length).toBe(20);
  for (const city of expected.cities) {
    const row = table.locator(`tr[data-city="${city.slug}"]`);
    if (city.fit) {
      await expect(row.getByTestId("fit-raw").locator(".num")).toHaveText(share.format(city.fit.raw));
      await expect(row.getByTestId("fit-raw").locator("abbr.grade")).toHaveText("C");
      await expect(row.getByTestId("fit-pct").locator(".num")).toHaveText(one.format(city.fit.pct));
      await expect(row.getByTestId("fit-pct").locator("abbr.grade")).toHaveText("C");
      // A figure read from a demo reading says so, beside the figure.
      await expect(row.getByTestId("fit-raw").locator(".demo")).toHaveCount(city.fit.isDemo ? 1 : 0);
      await expect(row.getByTestId("fit-pct").locator(".demo")).toHaveCount(city.fit.isDemo ? 1 : 0);
      await expect(row.getByText(/^CSI .*120 menzioni$/)).toBeVisible();
    } else {
      await expect(row).toHaveAttribute("data-fit", "missing");
      await expect(row.locator(".hatched")).toHaveText(NO_READING);
      await expect(row.locator("abbr.grade")).toHaveCount(0);
      await expect(row.locator("td")).not.toContainText(/\d/);
    }
  }
  const withFit = expected.cities.filter((c) => c.fit).length;
  await expect(page.getByTestId("fit-summary")).toHaveText(`Fit calcolato in ${withFit} città su 20.`);
  await expect(page.getByTestId("fit-none")).toHaveCount(withFit === 0 ? 1 : 0);
  return withFit;
}

test("a member creates a passport with claims, sees Fit per city, and a saved change moves the Fit", async ({ page }, info) => {
  const category = await categoryOf(FIT_CATEGORY);
  const { userId } = await signIn(page, "member", "passport");
  await page.goto("/");

  // Entry point: the profile menu.
  await page.getByRole("button", { name: "Profilo e impostazioni" }).click();
  await page.getByRole("menu").getByRole("menuitem", { name: "Passaporto prodotto" }).click();
  await expect(page).toHaveURL(/\/passport$/);
  await expect(page.getByRole("heading", { level: 1, name: "Passaporto prodotto" })).toBeVisible();
  await expect(page.getByTestId("passport-empty").getByText("Nessun passaporto ancora")).toBeVisible();
  expect(await noSideScroll(page)).toBe(true);
  await page.screenshot({ path: `${SCREENS}/passport-empty-${info.project.name}.png`, fullPage: true });

  await page.getByTestId("passport-new").click();
  await expect(page).toHaveURL(/\/passport\/new$/);
  const form = page.getByTestId("passport-form");
  await expect(form.getByTestId("passport-claims").getByRole("checkbox")).toHaveCount(12);

  // Validation: no name, then too many free-text certifications. Nothing is saved.
  await form.getByRole("button", { name: "Crea il passaporto" }).click();
  await expect(form.getByRole("alert")).toHaveText("Dai un nome al prodotto, al massimo 120 caratteri.");
  const name = uniqueName("Caffè di prova");
  await form.getByLabel("Nome del prodotto").fill(name);
  await form.getByLabel("Categoria").selectOption({ label: category.name_it });
  await form.getByLabel("Fascia di prezzo").selectOption({ label: "Premium" });
  await form.getByLabel("Altre certificazioni").fill("a, b, c, d, e, f");
  await form.getByRole("button", { name: "Crea il passaporto" }).click();
  await expect(form.getByRole("alert")).toHaveText(/al massimo 5/);
  await form.getByLabel("Altre certificazioni").fill("Vegan OK");
  await form.getByRole("checkbox", { name: "DOP", exact: true }).check();
  await form.getByRole("checkbox", { name: /^Qualità e gusto/ }).check();
  expect(await noSideScroll(page)).toBe(true);
  await page.screenshot({ path: `${SCREENS}/passport-form-${info.project.name}.png`, fullPage: true });
  await form.getByRole("button", { name: "Crea il passaporto" }).click();

  await page.waitForURL(/\/passport\/\d+\?saved=1$/);
  const id = Number(new URL(page.url()).pathname.split("/").pop());
  passports.push(id);
  await expect(page.getByTestId("passport-saved")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

  // Stored for the member's own organisation, claims in attributes.claims.
  const { data: mem } = await admin.from("memberships").select("org_id").eq("user_id", userId).single();
  const { data: saved } = await admin.from("product_passports").select("org_id, created_by, price_band, certifications, attributes").eq("id", id).single();
  expect(saved?.org_id).toBe(mem?.org_id);
  expect(saved?.created_by).toBe(userId);
  expect(saved?.price_band).toBe("premium");
  expect(saved?.certifications).toEqual(["DOP", "Vegan OK"]);
  expect(saved?.attributes).toEqual({ claims: ["quality_taste"] });

  // The levers the passport answers: the claim, and those the DOP implies.
  const first: Passport = { priceBand: "premium", certifications: ["DOP", "Vegan OK"], claims: ["quality_taste"] };
  let expected = await expectedFit(FIT_CATEGORY, first);
  const levers = page.getByTestId("fit-levers").locator("li");
  await expect(levers).toHaveCount(expected.levers.length);
  for (const code of expected.levers) await expect(page.locator(`[data-lever="${code}"]`)).toContainText(LEVER_LABELS[code].it);
  await expect(page.locator('[data-lever="origin_territory"]')).toContainText("da certificazione o prezzo");
  await expect(page.locator('[data-lever="quality_taste"]')).not.toContainText("da certificazione o prezzo");

  const withFit = await expectFitTable(page, expected);
  expect(withFit, "the fixture gives Italy and Germany a reading").toBeGreaterThan(0);
  await expect(page.getByText("Metodo fit-v1.")).toBeVisible();
  expect(expected.cities.some((c) => !c.fit), "some pilot city has no reading").toBe(true);
  expect(await noSideScroll(page)).toBe(true);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SCREENS}/passport-fit-${info.project.name}.png`, fullPage: true });

  // Edit: one more claim. After the save the Fit is the one of the new passport.
  const edit = page.getByTestId("passport-form");
  await expect(edit.getByLabel("Nome del prodotto")).toHaveValue(name);
  await expect(edit.getByRole("checkbox", { name: "DOP", exact: true })).toBeChecked();
  await expect(edit.getByLabel("Altre certificazioni")).toHaveValue("Vegan OK");
  await edit.getByRole("checkbox", { name: /^Sostenibilità/ }).check();
  await edit.getByRole("button", { name: "Salva le modifiche" }).click();
  await expect(page.locator('[data-lever="sustainability"]')).toBeVisible();
  const before = expected;
  expected = await expectedFit(FIT_CATEGORY, { ...first, claims: ["quality_taste", "sustainability"] });
  await expectFitTable(page, expected);
  expect(expected.cities.map((c) => c.fit?.raw ?? null)).not.toEqual(before.cities.map((c) => c.fit?.raw ?? null));

  // The list shows it; deleting asks first, then it is gone.
  await page.getByRole("link", { name: "Tutti i passaporti" }).click();
  await expect(page.getByTestId("passport-row").filter({ hasText: name })).toContainText(category.name_it);
  await page.screenshot({ path: `${SCREENS}/passport-list-${info.project.name}.png`, fullPage: true });
  await page.getByTestId("passport-row").filter({ hasText: name }).click();
  await page.getByRole("button", { name: "Elimina il passaporto" }).click();
  await expect(page.getByText(/^Eliminare questo passaporto\?/)).toBeVisible();
  await page.getByRole("button", { name: "Sì, elimina" }).click();
  await page.waitForURL(/\/passport\?deleted=1$/);
  await expect(page.getByText("Passaporto eliminato.")).toBeVisible();
  await expect(page.getByTestId("passport-row").filter({ hasText: name })).toHaveCount(0);
  const { data: gone } = await admin.from("product_passports").select("id").eq("id", id);
  expect(gone).toEqual([]);
});

type Snap = { key: string; category: string; mos: number | null; components: unknown };

async function snapshots(): Promise<Snap[]> {
  const read = () => admin.from("cells").select("categories(slug), territories(slug), mos_snapshots(mos, components)").not("mos_snapshot_id", "is", null);
  let { data, error } = await read();
  if (error) ({ data, error } = await read()); // the local stack can drop a request under parallel load
  if (error) throw new Error(`snapshots: ${error.message || JSON.stringify(error)}`);
  type Row = { categories: { slug: string }; territories: { slug: string }; mos_snapshots: { mos: number | null; components: unknown } };
  return (data as unknown as Row[]).map((r) => ({
    key: `${r.categories.slug}:${r.territories.slug}`,
    category: r.categories.slug,
    mos: r.mos_snapshots.mos == null ? null : Number(r.mos_snapshots.mos),
    components: r.mos_snapshots.components,
  }));
}

test("Opportunities: a selected passport adds Fit to its category, re-ranks in the browser and is labelled as an organisation view", async ({ page }, info) => {
  const phone = isPhone(info);
  const { userId } = await signIn(page, "member", "passport");
  const name = uniqueName("Passaporto classifica");
  const { id } = await insertPassport(userId, name, ["quality_taste"], ["DOP"]);
  passports.push(id);
  const expected = await expectedFit(FIT_CATEGORY, { priceBand: "premium", certifications: ["DOP"], claims: ["quality_taste"] });
  const fitOf = new Map<string, number>(expected.cities.flatMap((c) => (c.fit ? [[`${FIT_CATEGORY}:${c.slug}`, c.fit.pct] as const] : [])));
  const demoFit = new Set(expected.cities.flatMap((c) => (c.fit?.isDemo ? [`${FIT_CATEGORY}:${c.slug}`] : [])));
  const snaps = await snapshots();
  const { data: ws } = await admin.from("weight_sets").select("weights").is("org_id", null).eq("is_default", true).single();
  const defaults = ws!.weights as Weights;
  const withFit = (s: Snap) => ({ ...toCellComponents(parseMosComponents(s.components)), ...(fitOf.has(s.key) ? { fit: { pct: fitOf.get(s.key)!, grade: "C" as const } } : {}) });
  const top = (score: (s: Snap) => number | null) =>
    snaps
      .map(score)
      .filter((m): m is number => m != null)
      .sort((a, b) => b - a)
      .slice(0, 30)
      .map((m) => one.format(m));

  // Default: no passport, the stored system scores, no badge.
  await page.goto("/opportunities");
  const rows = page.getByTestId("opp-row");
  const mosText = rows.getByTestId("opp-mos").locator(".t-figure");
  const select = page.getByTestId("passport-select");
  await expect(select).toHaveValue("");
  await expect(mosText).toHaveText(top((s) => s.mos));
  await expect(page.getByTestId("orgview-badge")).toHaveCount(0);
  await expect(page.getByTestId("opp-fit-note")).toHaveCount(0);
  const storedOrder = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-key")));

  // Only the organisation's passports are offered.
  await expect(select.locator("option")).toHaveText(["Nessuno (punteggi di sistema)", name]);
  await select.selectOption({ label: name });
  await page.waitForURL(new RegExp(`/opportunities\\?passport=${id}$`));
  await expect(select).toHaveValue(String(id));

  const affected = snaps.filter((s) => fitOf.has(s.key));
  expect(affected.length, "the fixture gives some ranked coffee cells a Fit").toBeGreaterThan(0);

  // Organisation view under the default weights: rows with Fit are rescored, the others keep the stored score.
  await expect(page.getByTestId("orgview-badge")).toHaveText("Vista organizzazione");
  await expect(page.getByTestId("orgview-note")).toContainText(name);
  await expect(page.getByTestId("whatif-badge")).toHaveCount(0);
  await expect(mosText).toHaveText(top((s) => (fitOf.has(s.key) ? scoreMos(withFit(s), defaults).mos : s.mos)));
  await expect(page.locator('[data-testid="opp-row"][data-org="true"]')).toHaveCount(affected.filter((s) => s.mos != null).length);
  for (const s of snaps.filter((x) => x.mos != null)) {
    const row = page.locator(`[data-testid="opp-row"][data-key="${s.key}"]`);
    const fit = row.locator('[data-component="fit"]');
    if (!(await row.count())) continue; // beyond the first page of the list
    if (fitOf.has(s.key)) {
      await expect(row.getByTestId("opp-fit-note")).toHaveText(new RegExp(`Fit percentile ${one.format(fitOf.get(s.key)!)}\\s*C\\s*(DEMO)?\\s*con passaporto: ${name}`));
      await expect(row.getByTestId("opp-fit-note").locator(".demo")).toHaveCount(demoFit.has(s.key) ? 1 : 0);
      await expect(fit.locator(".num")).toHaveText(one.format(scoreMos(withFit(s), defaults).contributions.fit!));
      await expect(fit.locator("abbr.grade")).toHaveText("C");
    } else {
      // Other categories, and cities without a reading: Fit stays unavailable, the stored MOS stays.
      await expect(row.getByTestId("opp-fit-note")).toHaveCount(0);
      await expect(fit.locator(".hatched")).toBeVisible();
      await expect(row.getByTestId("opp-mos").locator(".t-figure")).toHaveText(one.format(s.mos!));
    }
  }
  expect(await noSideScroll(page)).toBe(true);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SCREENS}/opportunities-passport-${info.project.name}.png`, fullPage: true });

  // What-if on top of the organisation view: all the weight on Fit. The server hears nothing.
  if (phone) await page.getByRole("button", { name: "Apri i pesi" }).tap();
  await expect(page.getByRole("slider", { name: "Peso di Fit" })).toBeVisible();
  await expect(page.getByTestId("weight-panel")).toContainText(`Il Fit viene dal passaporto «${name}»`);
  await page.waitForLoadState("networkidle");
  const requests: string[] = [];
  page.on("request", (r) => requests.push(`${r.method()} ${r.url()}`));
  for (const [label, value] of [["Crescita", 0], ["Dimensione", 0], ["CSI", 0], ["Pressione", 0], ["Fit", 100]] as const) {
    await page.getByRole("slider", { name: `Peso di ${label}` }).fill(String(value));
  }
  await expect(page.getByTestId("whatif-badge")).toBeVisible();
  await expect(page.getByTestId("orgview-badge")).toBeVisible();
  await expect(mosText).toHaveText(top((s) => scoreMos(withFit(s), FIT_ONLY).mos));
  const after = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-key")));
  expect(after.every((k) => fitOf.has(k ?? ""))).toBe(true);
  expect(after).not.toEqual(storedOrder);
  await page.waitForTimeout(600);
  expect(requests, "moving the weights must not call the server").toEqual([]);
  await page.screenshot({ path: `${SCREENS}/opportunities-passport-whatif-${info.project.name}.png` });

  // The stored system snapshots are untouched: without the passport the stored ranking is back.
  expect((await snapshots()).map((s) => [s.key, s.mos])).toEqual(snaps.map((s) => [s.key, s.mos]));
  await page.goto("/opportunities");
  await expect(page.getByTestId("orgview-badge")).toHaveCount(0);
  await expect(mosText).toHaveText(top((s) => s.mos));

  // A passport whose category has no published reading: said in words, system scores as they are.
  const bare = await expectedFit(NO_READING_CATEGORY, { priceBand: "premium", certifications: [], claims: ["novelty"] });
  if (bare.cities.every((c) => !c.fit)) {
    const bareName = uniqueName("Passaporto senza lettura");
    const other = await insertPassport(userId, bareName, ["novelty"], [], NO_READING_CATEGORY);
    passports.push(other.id);
    await page.goto(`/opportunities?passport=${other.id}`);
    await expect(page.getByTestId("orgview-nofit")).toContainText(bareName);
    await expect(page.getByTestId("orgview-badge")).toHaveCount(0);
    await expect(page.getByTestId("opp-fit-note")).toHaveCount(0);
    await expect(mosText).toHaveText(top((s) => s.mos));
    await page.screenshot({ path: `${SCREENS}/opportunities-passport-nofit-${info.project.name}.png`, fullPage: true });
  }
});

test("a passport belongs to its organisation: another member cannot see or select it, and a viewer reads without editing", async ({ page, browser }, info) => {
  const owner = await signIn(page, "member", "passport-owner");
  const name = uniqueName("Passaporto riservato");
  const { id } = await insertPassport(owner.userId, name, ["quality_taste"]);
  passports.push(id);
  await page.goto("/passport");
  await expect(page.getByTestId("passport-row").filter({ hasText: name })).toBeVisible();

  // A member of another organisation: not in the list, not by address, not on Opportunities.
  const other = await otherPage(browser, info);
  await signIn(other.page, "member", "passport-other");
  await other.page.goto("/passport");
  await expect(other.page.getByRole("heading", { level: 1, name: "Passaporto prodotto" })).toBeVisible();
  await expect(other.page.getByText(name)).toHaveCount(0);
  await expect(other.page.getByTestId("passport-empty")).toBeVisible();
  await other.page.goto(`/passport/${id}`);
  await expect(other.page.getByRole("heading", { level: 1, name: "Passaporto non trovato" })).toBeVisible();
  await expect(other.page.getByTestId("fit-panel")).toHaveCount(0);
  await other.page.goto(`/opportunities?passport=${id}`);
  await expect(other.page.getByTestId("opp-row").first()).toBeVisible();
  await expect(other.page.getByTestId("orgview-missing")).toBeVisible();
  await expect(other.page.getByTestId("orgview-badge")).toHaveCount(0);
  await expect(other.page.getByTestId("opp-fit-note")).toHaveCount(0);
  await expect(other.page.getByTestId("passport-select")).toHaveCount(0);
  await expect(other.page.getByText(name)).toHaveCount(0);
  await other.ctx.close();

  // A viewer of an organisation with a passport: reads it and its Fit, has no form and no way to create.
  const viewer = await otherPage(browser, info);
  const v = await signIn(viewer.page, "viewer", "passport-viewer");
  const viewerName = uniqueName("Passaporto in lettura");
  const mine = await insertPassport(v.userId, viewerName, ["novelty"], ["BIO"]);
  passports.push(mine.id);
  await viewer.page.goto("/passport");
  await expect(viewer.page.getByTestId("passport-readonly")).toHaveText("Il tuo ruolo può consultare i passaporti, non crearli né modificarli.");
  await expect(viewer.page.getByTestId("passport-new")).toHaveCount(0);
  await expect(viewer.page.getByText(name)).toHaveCount(0);
  await viewer.page.getByTestId("passport-row").filter({ hasText: viewerName }).click();
  await expect(viewer.page.getByRole("heading", { level: 1, name: viewerName })).toBeVisible();
  await expect(viewer.page.getByTestId("passport-readonly")).toHaveText("Il tuo ruolo può consultare questo passaporto, non modificarlo.");
  await expect(viewer.page.getByTestId("passport-form")).toHaveCount(0);
  await expect(viewer.page.getByRole("button", { name: "Elimina il passaporto" })).toHaveCount(0);
  await expect(viewer.page.getByTestId("passport-summary")).toContainText("BIO");
  await expect(viewer.page.getByTestId("passport-summary")).toContainText(LEVER_LABELS.novelty.it);
  await expectFitTable(viewer.page, await expectedFit(FIT_CATEGORY, { priceBand: "premium", certifications: ["BIO"], claims: ["novelty"] }));
  expect(await noSideScroll(viewer.page)).toBe(true);
  await viewer.page.waitForTimeout(400);
  await viewer.page.screenshot({ path: `${SCREENS}/passport-viewer-${info.project.name}.png`, fullPage: true });
  await viewer.page.goto("/passport/new");
  await expect(viewer.page.getByTestId("passport-readonly")).toBeVisible();
  await expect(viewer.page.getByTestId("passport-form")).toHaveCount(0);
  await viewer.ctx.close();
});

test("the Opportunity tab's Fit note links to the passport screen, in English too", async ({ page }) => {
  const cell = (await snapshots()).find((s) => s.mos != null)!;
  const [category, territory] = cell.key.split(":");
  await signIn(page, "member", "passport");
  await page.goto(`/cell/${category}/${territory}?tab=opportunity`);
  await page.locator('[data-component="fit"]').getByRole("link", { name: "Compila il passaporto" }).click();
  await expect(page).toHaveURL(/\/passport$/);
  await page.goto("/en/passport");
  await expect(page.getByRole("heading", { level: 1, name: "Product passport" })).toBeVisible();
  await expect(page.getByText("No passport yet")).toBeVisible();
  await page.goto("/en/passport/new");
  await expect(page.getByRole("checkbox", { name: /^Value for money/ })).toBeVisible();
});
