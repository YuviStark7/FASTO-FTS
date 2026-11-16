import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

// Release accessibility pass (SPEC sections 6 and 10): WCAG 2.1 A and AA rules on every main
// screen, at both widths, signed in as a member (and as an admin for the admin screens).
const STYLE = JSON.stringify({ version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#224466" } }] });
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function scan(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
  const r = await new AxeBuilder({ page }).withTags(WCAG).exclude(".maplibregl-canvas").analyze();
  return r.violations.map((v) => `${path} [${v.impact}] ${v.id}: ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

test.beforeEach(async ({ page }) => {
  await page.context().route("https://tiles.openfreemap.org/**", (r) => r.fulfill({ contentType: "application/json", body: STYLE }));
});

test("public pages", async ({ page }) => {
  const found = [...(await scan(page, "/login")), ...(await scan(page, "/privacy"))];
  expect(found, found.join("\n")).toEqual([]);
});

test("member screens", async ({ page }) => {
  await signIn(page, "member", "a11y");
  const found: string[] = [];
  for (const path of ["/", "/matrix", "/map", "/cell/cheese/roma", "/cell/cheese/roma?tab=consumers", "/cell/cheese/roma?tab=opportunity", "/cell/cheese/roma?tab=sources", "/opportunities", "/ask", "/briefs", "/passport", "/more"]) {
    found.push(...(await scan(page, path)));
  }
  expect(found, found.join("\n")).toEqual([]);
});

test("admin screens", async ({ page }) => {
  await signIn(page, "admin", "a11y");
  const found: string[] = [];
  for (const path of ["/admin", "/admin/sources", "/admin/runs", "/admin/usage", "/admin/audit", "/admin/users", "/admin/acceptance", "/admin/feedback", "/admin/ask-eval"]) {
    found.push(...(await scan(page, path)));
  }
  expect(found, found.join("\n")).toEqual([]);
});
