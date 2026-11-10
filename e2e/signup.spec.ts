import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Day 1 gate: a new user signs up and lands on the Scout screen.
// The magic link is generated through the admin API so the test does not depend on an inbox.
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});

test("signed-out visitor is sent to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Accedi a FASTO FTS" })).toBeVisible();
});

test("new user signs up by magic link and lands on Scout", async ({ page }, info) => {
  const email = `e2e-${info.project.name}-${Date.now()}@test.local`;
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  expect(error).toBeNull();

  await page.goto(`/auth/confirm?token_hash=${data.properties!.hashed_token}&type=magiclink&next=/`);
  await expect(page).toHaveURL(/\/(\?.*)?$/);

  // Verdict: every cell starts as insufficient data, never as a low score.
  await expect(page.getByRole("heading", { level: 1, name: "Dati insufficienti" })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Scegli una categoria" }).getByRole("radio")).toHaveCount(15);
  await expect(page.getByRole("radiogroup", { name: "Scegli un territorio" }).getByRole("radio")).toHaveCount(20);

  // Two interactions: pick a category, pick a territory.
  await page.getByRole("radio", { name: "Miele" }).click();
  await page.getByRole("radio", { name: /Bologna/ }).click();
  await expect(page).toHaveURL(/c=honey&t=bologna/);
  await expect(page.getByRole("radio", { name: "Miele" })).toHaveAttribute("aria-checked", "true");

  // Navigation is visible and reachable at this width.
  await expect(page.getByRole("navigation", { name: "Navigazione principale" })).toBeVisible();
  await page.waitForTimeout(600); // let the 300 ms transitions settle before the visual record
  await page.screenshot({ path: `test-results/scout-${info.project.name}.png`, fullPage: true });
});

test("English locale", async ({ page }, info) => {
  const email = `e2e-en-${info.project.name}-${Date.now()}@test.local`;
  const { data } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  await page.goto(`/auth/confirm?token_hash=${data.properties!.hashed_token}&type=magiclink&next=/en`);
  await expect(page.getByRole("heading", { level: 1, name: "Insufficient data" })).toBeVisible();
});
