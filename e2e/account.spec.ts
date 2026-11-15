import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { admin, signIn } from "./helpers";

test("the privacy notice is public and linked from sign-in", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Informativa privacy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: "Informativa privacy", level: 1 })).toBeVisible();
  await expect(page.getByText(/non conserva dati personali di consumatori/)).toBeVisible();
});

test("a member downloads their own data as JSON", async ({ page }) => {
  const { email, userId } = await signIn(page, "member", "acct");
  const { data: m } = await admin.from("memberships").select("org_id").eq("user_id", userId).single();
  const { data: conv } = await admin.from("conversations").insert({ org_id: m!.org_id, user_id: userId, title: "export check", locale: "it" }).select("id").single();
  await admin.from("messages").insert({ conversation_id: conv!.id, org_id: m!.org_id, role: "user", content: { text: "Formaggi a Roma?" } });

  await page.goto("/more");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Scarica i miei dati" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^fasto-fts-account-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(readFileSync((await download.path())!, "utf8"));
  expect(data.account).toMatchObject({ user_id: userId, email });
  expect(data.memberships[0]).toMatchObject({ role: "member" });
  expect(data.conversations[0].messages[0].content.text).toBe("Formaggi a Roma?");
  await admin.auth.admin.deleteUser(userId);
});

test("a member deletes their account after typing their email", async ({ page }) => {
  const { email, userId } = await signIn(page, "member", "acct");
  const { data: m } = await admin.from("memberships").select("org_id").eq("user_id", userId).single();
  await page.goto("/more");
  await page.getByTestId("delete-account-open").click();
  const confirm = page.getByRole("button", { name: "Elimina definitivamente" });
  await expect(confirm).toBeDisabled();
  await page.getByRole("textbox").fill("someone-else@test.local");
  await expect(confirm).toBeDisabled();
  await page.getByRole("textbox").fill(email);
  await expect(confirm).toBeEnabled();
  // Submit from the field (Enter): on the phone profile the focused field keeps re-scrolling into
  // view, so a click on the button below it lands on the content above.
  await page.getByRole("textbox").press("Enter");
  await expect(page).toHaveURL(/\/login\?deleted=1/);
  await expect(page.getByTestId("account-deleted")).toBeVisible();

  const { data: user } = await admin.auth.admin.getUserById(userId);
  expect(user.user, "the auth user is gone").toBeNull();
  const { count } = await admin.from("organizations").select("id", { count: "exact", head: true }).eq("id", m!.org_id);
  expect(count, "the personal organisation is gone").toBe(0);
  // Signed out: the app sends them to sign-in.
  await page.goto("/more");
  await expect(page).toHaveURL(/\/login/);
});

test("the last admin cannot delete their account", async ({ page }) => {
  // Make this test's admin the only admin for the duration, restoring the others afterwards.
  const { data: others } = await admin.from("memberships").select("org_id, user_id").eq("role", "admin");
  const { email, userId } = await signIn(page, "admin", "acct");
  try {
    for (const o of others ?? []) await admin.from("memberships").update({ role: "analyst" }).eq("org_id", o.org_id).eq("user_id", o.user_id);
    await page.goto("/more");
    await page.getByTestId("delete-account-open").click();
    await page.getByRole("textbox").fill(email);
    await page.getByRole("textbox").press("Enter");
    await expect(page.locator("#delete-account-error")).toContainText("Sei l'unico amministratore");
    const { data: user } = await admin.auth.admin.getUserById(userId);
    expect(user.user).not.toBeNull();
  } finally {
    for (const o of others ?? []) await admin.from("memberships").update({ role: "admin" }).eq("org_id", o.org_id).eq("user_id", o.user_id);
  }
});
