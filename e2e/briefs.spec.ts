import { test, expect, type Page } from "@playwright/test";
import { admin, signIn } from "./helpers";
import { deleteBrief, insertBrief } from "./advisor-fixtures";

// Briefs are unique per cell and both viewport projects run in parallel: every test and project owns its cells.
const CATEGORY = "vinegar-condiments";
const cellFor = (phone: string, desktop: string) => (test.info().project.name.startsWith("phone") ? phone : desktop);
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

test("analyst: list, detail with chips and graded facts, review controls and version history", async ({ page }, info) => {
  const territory = cellFor("bari", "venezia");
  const { briefId, versionIds } = await insertBrief({ category: CATEGORY, territory, status: "draft", versions: [{ passed: true, dropped: 0 }, { passed: true, dropped: 2 }], current: 1 });
  try {
    await signIn(page, "analyst", "brief");

    // Briefs is reached from the profile menu, not from the header chips.
    await page.getByRole("button", { name: "Profilo e impostazioni" }).click();
    await page.getByRole("menuitem", { name: "Brief" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Brief" })).toBeVisible();
    const row = page.locator(`[data-testid="brief-row"][href$="/briefs/${briefId}"]`);
    await expect(row.getByTestId("brief-status")).toHaveText("Bozza");
    await expect(row).toContainText("Versione 2");
    await expect(row.getByText("DEMO")).toBeVisible();
    await row.click();

    await expect(page.getByTestId("brief-version")).toHaveText("Versione 2");
    const body = page.getByTestId("brief-body");
    await expect(body.getByTestId("cited-sentence")).toHaveCount(4);
    await expect(body.getByTestId("fact-chip")).toHaveCount(3);
    await expect(body.getByRole("heading", { name: "Territorio" })).toBeVisible();

    // Facts list: only cited facts, each with a grade badge; grade C is visibly indicative.
    const facts = page.getByTestId("facts-list").getByTestId("fact");
    await expect(facts).toHaveCount(3);
    for (const [i, g] of ["A", "B", "C"].entries()) await expect(facts.nth(i).locator(`.grade-${g}`)).toHaveText(g);
    await expect(facts.nth(2)).toContainText("indicativo");
    await expect(facts.nth(1)).toContainText("geo-v1");
    await expect(page.getByTestId("facts-list")).not.toContainText("Fatto mai citato");

    // Tapping a marker moves focus to its fact.
    await body.getByTestId("fact-chip").nth(2).click();
    await expect(page.locator("#brief-F3")).toBeFocused();

    // Context: status as icon and word, missing inputs, representativeness note.
    const context = page.getByTestId("brief-context").filter({ visible: true });
    await expect(context).toContainText("In espansione");
    await expect(context).toContainText("concorrenza");
    await expect(context).toContainText("non sono un campione rappresentativo");

    // Staff only: dropped sentences, review controls. Analysts do not publish.
    const staff = page.getByTestId("staff-panel");
    await expect(staff.getByTestId("dropped")).toContainText("2 frasi rimosse dal controllo citazioni");
    await expect(staff.getByRole("button", { name: "Pubblica", exact: true })).toHaveCount(0);
    await staff.getByRole("button", { name: "Segna come revisionato" }).click();
    await expect(page.getByTestId("brief-status").first()).toHaveText("Revisionato");
    await expect(staff.getByRole("button", { name: "Riporta in bozza" })).toBeVisible();
    await expect(staff.getByRole("button", { name: "Genera una nuova versione" })).toBeVisible();

    await expect(page.getByTestId("feedback-control").getByText("Questo brief è corretto?")).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
    await page.screenshot({ path: `test-results/brief-detail-analyst-${info.project.name}.png`, fullPage: true });

    // Version history: open the older version.
    await expect(page.getByTestId("version-row")).toHaveCount(2);
    await page.getByRole("link", { name: "Vedi la versione 1" }).click();
    await expect(page).toHaveURL(new RegExp(`\\?v=${versionIds[0]}$`));
    await expect(page.getByTestId("brief-version")).toHaveText("Versione 1");
    await expect(page.getByTestId("not-current")).toBeVisible();
    await expect(page.getByTestId("staff-panel").getByTestId("dropped")).toContainText("Nessuna frase rimossa");
  } finally {
    await deleteBrief(briefId);
  }
});

test("member: reads published briefs only, without review controls; print page and Word export", async ({ page }, info) => {
  const territory = cellFor("cagliari", "palermo");
  const published = await insertBrief({ category: CATEGORY, territory, status: "published", versions: [{ passed: true }, { passed: true }], current: 0 });
  const draft = await insertBrief({ category: CATEGORY, territory: cellFor("firenze", "bologna"), status: "draft", versions: [{ passed: true }], current: 0 });
  const { userId } = await signIn(page, "member", "brief");
  try {
    await page.goto("/briefs");
    await expect(page.locator(`[data-testid="brief-row"][href$="/briefs/${published.briefId}"]`).getByTestId("brief-status")).toHaveText("Pubblicato");
    await expect(page.locator(`[href$="/briefs/${draft.briefId}"]`)).toHaveCount(0);
    await page.screenshot({ path: `test-results/briefs-list-${info.project.name}.png` });

    // A draft is not there for a member (RLS), whatever the URL.
    await page.goto(`/briefs/${draft.briefId}`);
    await expect(page.getByRole("heading", { name: "Brief non trovato" })).toBeVisible();

    // The newer, unreviewed version of a published brief is not shown to a member either.
    await page.goto(`/briefs/${published.briefId}?v=${published.versionIds[1]}`);
    await expect(page.getByTestId("brief-version")).toHaveText("Versione 1");
    await expect(page.getByTestId("brief-body").getByTestId("fact-chip")).toHaveCount(3);
    await expect(page.getByTestId("facts-list").locator(".grade")).toHaveCount(3);
    await expect(page.getByTestId("staff-panel")).toHaveCount(0);
    await expect(page.getByTestId("review-controls")).toHaveCount(0);
    await expect(page.getByTestId("version-history")).toHaveCount(0);
    await expect(page.getByTestId("generate-brief")).toHaveCount(0);
    await expect(page.getByText(/rimoss[ae] dal controllo/)).toHaveCount(0);

    // PDF: print route with header, citation markers and the full sources table, always light.
    await page.getByRole("link", { name: "PDF" }).click();
    const sheet = page.getByTestId("print-sheet");
    await expect(sheet.getByRole("heading", { level: 1 })).toContainText("Brief di ingresso");
    const meta = page.getByTestId("print-meta");
    for (const s of ["Versione", "Pubblicato", "test-model", "brief.v1"]) await expect(meta).toContainText(s);
    await expect(page.getByTestId("demo-watermark")).toHaveText("DEMO");
    await expect(sheet.getByTestId("print-marker")).toHaveText(["[F1]", "[F2]", "[F3]"]);
    const rows = page.getByTestId("sources-table").getByTestId("sources-row");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("Dato misurato");
    await expect(rows.nth(1)).toContainText("Stima da modello");
    await expect(rows.nth(1)).toContainText("geo_estimates:1");
    await expect(rows.nth(2)).toContainText("Segnale esplorativo");
    await expect(rows.locator(".grade")).toHaveCount(3);
    expect(await sheet.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 255, 255)");
    expect(await noOverflow(page)).toBe(true);
    await page.screenshot({ path: `test-results/brief-print-${info.project.name}.png`, fullPage: true });

    // The print button records the export, then opens the print dialog.
    await page.evaluate(() => {
      window.print = () => document.body.setAttribute("data-printed", "1");
    });
    await page.getByRole("button", { name: "Stampa / Salva PDF" }).click();
    await expect(page.locator("body[data-printed]")).toHaveCount(1);

    // Word: a real .docx from the route handler.
    const res = await page.request.get(`/briefs/${published.briefId}/docx`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe(DOCX);
    expect(res.headers()["content-disposition"]).toContain(`brief-${CATEGORY}-${territory}-v1.docx`);
    expect((await res.body()).subarray(0, 2).toString()).toBe("PK");
    expect((await page.request.get(`/briefs/${draft.briefId}/docx`)).status()).toBe(404);

    const { data: exports } = await admin.from("exports").select("format, brief_version_id").eq("user_id", userId);
    expect((exports ?? []).map((e) => e.format).sort()).toEqual(["docx", "pdf"]);
    expect(new Set((exports ?? []).map((e) => e.brief_version_id))).toEqual(new Set([published.versionIds[0]]));
  } finally {
    await admin.from("exports").delete().eq("user_id", userId);
    await deleteBrief(published.briefId);
    await deleteBrief(draft.briefId);
  }
});

test("admin: a version that failed the citation check is neither exported nor published; a passing one is", async ({ page }, info) => {
  const territory = cellFor("genova", "verona");
  const { briefId, versionIds } = await insertBrief({ category: CATEGORY, territory, status: "draft", versions: [{ passed: true }, { passed: false }], current: 1 });
  const { userId } = await signIn(page, "admin", "brief");
  try {
    await page.goto(`/briefs/${briefId}`);
    const staff = page.getByTestId("staff-panel");
    await expect(staff.getByTestId("citation-check")).toContainText("non superato");
    await expect(staff.getByRole("button", { name: "Pubblica", exact: true })).toBeDisabled();
    await expect(page.getByRole("link", { name: "PDF" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Word" })).toHaveCount(0);
    await expect(page.getByTestId("export-refused")).toBeVisible();

    expect((await page.request.get(`/briefs/${briefId}/docx`)).status()).toBe(409);
    await page.goto(`/briefs/${briefId}/print`);
    await expect(page.getByTestId("export-refused")).toContainText("non ha superato il controllo delle citazioni");
    await expect(page.getByTestId("sources-table")).toHaveCount(0);
    const { data: none } = await admin.from("exports").select("id").eq("user_id", userId);
    expect(none ?? []).toHaveLength(0);

    // Publish the version that passed, from the history.
    await page.goto(`/briefs/${briefId}`);
    const v1 = page.getByTestId("version-row").filter({ hasText: "Versione 1" });
    await expect(page.getByTestId("version-row").filter({ hasText: "Versione 2" }).getByRole("button", { name: "Pubblica questa versione" })).toBeDisabled();
    await v1.getByRole("button", { name: "Pubblica questa versione" }).click();
    await expect(page.getByTestId("brief-status").first()).toHaveText("Pubblicato");
    await expect(v1).toContainText("Attuale");
    await expect(staff.getByRole("button", { name: "Ritira la pubblicazione" })).toBeVisible();
    const { data: b } = await admin.from("briefs").select("status, current_version_id").eq("id", briefId).single();
    expect(b).toEqual({ status: "published", current_version_id: versionIds[0] });
    expect(await noOverflow(page)).toBe(true);
    await page.screenshot({ path: `test-results/brief-detail-admin-${info.project.name}.png`, fullPage: true });
  } finally {
    await admin.from("exports").delete().eq("user_id", userId);
    await deleteBrief(briefId);
  }
});

test("viewer: reads a published brief but cannot export it", async ({ page }) => {
  const territory = cellFor("napoli", "torino");
  const { briefId } = await insertBrief({ category: CATEGORY, territory, status: "published", versions: [{ passed: true }], current: 0 });
  try {
    await signIn(page, "viewer", "brief");
    await page.goto(`/briefs/${briefId}`);
    await expect(page.getByTestId("brief-body").getByTestId("fact-chip")).toHaveCount(3);
    await expect(page.getByRole("link", { name: "PDF" })).toHaveCount(0);
    await expect(page.getByTestId("export-refused")).toContainText("sola lettura");
    expect((await page.request.get(`/briefs/${briefId}/docx`)).status()).toBe(403);
  } finally {
    await deleteBrief(briefId);
  }
});
