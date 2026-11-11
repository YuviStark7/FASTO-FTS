import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

test("matrix shows all 300 cells and filters on the client", async ({ page }, info) => {
  await signIn(page);
  await page.goto("/matrix");
  await expect(page.getByRole("heading", { level: 1, name: "Matrice" })).toBeVisible();
  // Tests never assume what the data says: Organic has no statistical class, so it is
  // insufficient data in every city whatever the connectors have loaded.
  const desktop = info.project.name.startsWith("desktop");
  const noPageScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

  if (desktop) {
    const table = page.getByRole("table", { name: "Matrice categorie per territori" });
    await expect(table.getByRole("link")).toHaveCount(300);
    await expect(table.getByRole("rowheader")).toHaveCount(15);
    await expect(table.getByRole("link", { name: "Biologico a Milano: Dati insufficienti" })).toBeVisible();
    expect(await noPageScroll()).toBe(true); // the grid scrolls inside its own box

    await page.getByLabel("Paese").selectOption("IT");
    await expect(table.getByRole("link")).toHaveCount(180);

    // MOS mode: nothing is faked, the state is explained.
    await page.getByRole("button", { name: "MOS", exact: true }).click();
    await expect(page.getByText("Il MOS non è ancora disponibile")).toBeVisible();
    await page.getByRole("button", { name: "Stato", exact: true }).click();

    await page.getByLabel("Filtra per stato").selectOption("insufficient_data");
    await expect(table.getByRole("link", { name: "Biologico a Milano: Dati insufficienti" })).toBeVisible();
    const names = await table.getByRole("link").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? e.textContent ?? ""));
    expect(names.length).toBeGreaterThanOrEqual(12); // country filter is still Italy: Organic in 12 cities
    expect(names.every((n) => n.endsWith("Dati insufficienti"))).toBe(true);
    await page.getByRole("button", { name: "Azzera i filtri" }).first().click();
    await expect(table.getByRole("link")).toHaveCount(300);
  } else {
    const list = page.getByTestId("matrix-list");
    await expect(list.getByRole("button")).toHaveCount(15);
    await list.getByRole("button").first().click();
    await expect(list.getByRole("link")).toHaveCount(20);
    expect(await noPageScroll()).toBe(true);
    await page.getByLabel("Paese").selectOption("IT");
    await expect(list.getByRole("link")).toHaveCount(12);
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/matrix-${info.project.name}.png` });
});
