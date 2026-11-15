import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { admin, signIn } from "./helpers";

/*
 * Usage and spend, audit log, users and roles (admins only).
 * `app_config` is one global row set shared by both viewports (and by anyone else on the local
 * database), so the tests that change it take a cross-process lock and restore what they found.
 * `audit_log` is append-only: the entries these tests cause stay there by design.
 */

const LOCK = path.join(os.tmpdir(), "fasto-e2e-app-config.lock");
async function withConfigLock<T>(fn: () => Promise<T>): Promise<T> {
  for (;;) {
    try {
      fs.mkdirSync(LOCK);
      break;
    } catch {
      // A holder that crashed: steal the lock after two minutes.
      const age = Date.now() - (fs.statSync(LOCK, { throwIfNoEntry: false })?.mtimeMs ?? Date.now());
      if (age > 120_000) fs.rmSync(LOCK, { recursive: true, force: true });
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  try {
    return await fn();
  } finally {
    fs.rmSync(LOCK, { recursive: true, force: true });
  }
}

const configValue = async (key: string) => (await admin.from("app_config").select("value").eq("key", key).single()).data?.value;
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** A fresh member that never signs in. Returns the ids needed to assert and to clean up. */
async function seedUser(tag: string) {
  const email = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.local`;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("no user");
  const { data: m } = await admin.from("memberships").select("org_id").eq("user_id", data.user.id).single();
  return { email, userId: data.user.id, orgId: m!.org_id as string };
}
/**
 * Removes a test user and their personal organisation. Best effort: the database keeps the last
 * admin, so a test admin that is the only admin left cannot be removed and stays.
 */
async function dropUser(userId: string) {
  const { data: orgs } = await admin.from("memberships").select("org_id").eq("user_id", userId);
  const { error } = await admin.auth.admin.deleteUser(userId).catch((e: Error) => ({ error: e }));
  if (error) return;
  for (const o of orgs ?? []) await admin.from("organizations").delete().eq("id", o.org_id).eq("is_personal", true);
}

test("an analyst is refused on usage, audit and users, and gets no tiles for them", async ({ page }) => {
  const { userId } = await signIn(page, "analyst", "ops");
  try {
    for (const p of ["/admin/usage", "/admin/audit", "/admin/users"]) {
      await page.goto(p);
      await expect(page.getByRole("heading", { name: "Accesso non consentito" })).toBeVisible();
      await expect(page.getByText("Questa pagina è riservata agli amministratori.", { exact: false })).toBeVisible();
    }
    await expect(page.getByRole("switch")).toHaveCount(0);
    await expect(page.getByRole("combobox")).toHaveCount(0);
    await page.goto("/admin");
    await expect(page.getByRole("link", { name: /Fonti/ })).toBeVisible();
    for (const name of [/Utilizzo e spesa/, /Registro delle modifiche/, /Utenti e ruoli/]) await expect(page.getByRole("link", { name })).toHaveCount(0);
  } finally {
    await dropUser(userId);
  }
});

test("a member is refused too", async ({ page }) => {
  const { userId } = await signIn(page, "member", "ops");
  try {
    for (const p of ["/admin/usage", "/admin/audit", "/admin/users"]) {
      await page.goto(p);
      await expect(page.getByRole("heading", { name: "Accesso non consentito" })).toBeVisible();
    }
  } finally {
    await dropUser(userId);
  }
});

test("admin sees today's usage and spend from the usage rows", async ({ page }, info) => {
  const project = info.project.name;
  const mod = `e2e-ops-${project}`; // one module per viewport: the two run in parallel on one database
  const seeded = await seedUser("ops-usage");
  const { userId: adminId } = await signIn(page, "admin", "ops");
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
  const base = { user_id: seeded.userId, org_id: seeded.orgId, module: mod, model: "e2e-model", created_at: new Date().toISOString() };
  try {
    const { error } = await admin.from("usage").insert([
      { ...base, kind: "chat_turn", input_tokens: 1000, output_tokens: 200, cost_usd: 0.0105 },
      { ...base, kind: "chat_turn", input_tokens: 2000, output_tokens: 300, cost_usd: 0.0201 },
      { ...base, kind: "brief", input_tokens: 5000, output_tokens: 1500, cost_usd: 0.3 },
      { ...base, kind: "classification", user_id: null, input_tokens: 400, output_tokens: 40, cost_usd: 0.0015 },
      { ...base, kind: "chat_turn", input_tokens: 10, output_tokens: 10, cost_usd: 1.25, created_at: yesterday.toISOString() },
    ]);
    if (error) throw error;
    await page.goto("/admin");
    await page.getByRole("link", { name: /Utilizzo e spesa/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Utilizzo e spesa" })).toBeVisible();
    await expect(page.getByTestId("estimate-note")).toContainText("Stima");
    await expect(page.getByTestId("estimate-note")).toContainText("prezzi di listino");

    // Today's total: at least what this test logged today (others may be logging too), against the limit.
    const today = page.getByTestId("spend-today");
    await expect(today.getByRole("heading", { name: "Spesa di oggi (stima)" })).toBeVisible();
    await expect(today.getByRole("progressbar")).toBeVisible();
    await expect(today).toContainText(/su .*USD di limite/);
    const figure = (await today.locator(".t-figure").innerText()).replace(/[^\d,]/g, "").replace(",", ".");
    expect(Number(figure)).toBeGreaterThanOrEqual(0.3321);
    await expect(page.getByTestId("spend-classification").getByRole("progressbar")).toBeVisible();
    const classification = (await page.getByTestId("spend-classification").locator(".t-figure").innerText()).replace(/[^\d,]/g, "").replace(",", ".");
    expect(Number(classification)).toBeGreaterThanOrEqual(0.0015);

    // Per module and kind: this viewport's own module, so the figures are exact.
    const rows = page.getByTestId("by-module").getByRole("row").filter({ hasText: mod });
    await expect(rows).toHaveCount(3);
    const chat = rows.filter({ hasText: "Chat" });
    await expect(chat.getByRole("cell")).toHaveText(["Chat", "2", "3000", "500", /^0,0306/]);
    await expect(chat).toContainText("0,0306");
    await expect(rows.filter({ hasText: "Brief" })).toContainText("0,30");
    await expect(rows.filter({ hasText: "Classificazione" })).toContainText("0,0015");

    // Top users, with their caps and the email from admin_users().
    const turns = Number(await configValue("ai.daily_chat_turns_per_user"));
    const briefs = Number(await configValue("ai.daily_briefs_per_user"));
    const user = page.getByTestId("top-users").getByRole("row").filter({ hasText: seeded.email });
    await expect(user).toContainText(`2 su ${turns}`);
    await expect(user).toContainText(`1 su ${briefs}`);
    await expect(user).toContainText("0,3306");

    // Last 14 days: yesterday's row carries yesterday's seeded turn.
    const y = page.getByTestId("by-day").locator(`tr[data-day="${yesterday.toISOString().slice(0, 10)}"]`);
    const yTotal = (await y.locator("td").nth(4).innerText()).replace(/[^\d,]/g, "").replace(",", ".");
    expect(Number(yTotal)).toBeGreaterThanOrEqual(1.25);
    await expect(page.getByTestId("by-day").locator("tbody tr")).toHaveCount(14);

    // Models are shown, not editable.
    await expect(page.getByTestId("ai.model.orchestrator")).toHaveText(String(await configValue("ai.model.orchestrator")));
    await expect(page.getByTestId("ai.model.classifier")).toHaveText(String(await configValue("ai.model.classifier")));
    await expect(page.getByRole("spinbutton")).toHaveCount(5);

    expect(await noOverflow(page)).toBe(true);
    await page.screenshot({ path: `test-results/admin-usage-${project}.png`, fullPage: true });
  } finally {
    await admin.from("usage").delete().eq("module", mod);
    await dropUser(seeded.userId);
    await dropUser(adminId);
  }
});

test("admin suspends and resumes AI, edits a cap, and the audit log names them", async ({ page }, info) => {
  test.setTimeout(180_000);
  const project = info.project.name;
  const { email, userId } = await signIn(page, "admin", "ops");
  try {
    await withConfigLock(async () => {
      const before = { enabled: await configValue("ai.enabled"), tokens: await configValue("ai.max_tokens_per_chat_turn"), turns: await configValue("ai.daily_chat_turns_per_user") };
      const tokens = Number(before.tokens) === 2100 ? 2200 : 2100;
      try {
        await admin.from("app_config").update({ value: true }).eq("key", "ai.enabled").neq("value", true);
        await page.goto("/admin/usage");
        await expect(page.getByTestId("ai-state")).toHaveText("AI attiva");

        // Kill switch: a confirm step, which can be backed out of.
        await page.getByRole("button", { name: "Sospendi l'AI" }).click();
        await expect(page.getByText("Sospendere tutte le chiamate AI per tutti gli utenti?")).toBeVisible();
        await page.getByRole("button", { name: "Annulla" }).click();
        expect(await configValue("ai.enabled")).toBe(true);
        await page.getByRole("button", { name: "Sospendi l'AI" }).click();
        await page.getByRole("button", { name: "Sì, sospendi" }).click();
        await expect(page.getByTestId("ai-state")).toHaveText("AI sospesa");
        expect(await configValue("ai.enabled")).toBe(false);
        expect(await noOverflow(page)).toBe(true);
        await page.screenshot({ path: `test-results/admin-usage-suspended-${project}.png` });

        await page.getByRole("button", { name: "Riattiva l'AI" }).click();
        await page.getByRole("button", { name: "Sì, riattiva" }).click();
        await expect(page.getByTestId("ai-state")).toHaveText("AI attiva");
        expect(await configValue("ai.enabled")).toBe(true);

        // Caps: out-of-range values are refused by the server and nothing is written.
        const turnsInput = page.getByLabel("Turni di chat per utente al giorno");
        const tokensInput = page.getByLabel("Token massimi per turno di chat");
        await turnsInput.fill("201");
        await tokensInput.fill("100");
        await page.getByRole("button", { name: "Salva i limiti" }).click();
        await expect(page.getByText("Fuori intervallo: da 0 a 200.")).toBeVisible();
        await expect(page.getByText("Fuori intervallo: da 256 a 8000.")).toBeVisible();
        expect(await configValue("ai.daily_chat_turns_per_user")).toBe(before.turns);
        expect(await configValue("ai.max_tokens_per_chat_turn")).toBe(before.tokens);
        await page.screenshot({ path: `test-results/admin-usage-caps-error-${project}.png`, fullPage: true });

        await turnsInput.fill("2.5");
        await tokensInput.fill(String(before.tokens));
        await page.getByRole("button", { name: "Salva i limiti" }).click();
        await expect(page.getByText("Serve un numero intero da 0 a 200.")).toBeVisible();
        expect(await configValue("ai.daily_chat_turns_per_user")).toBe(before.turns);

        // A valid edit persists and survives the reload.
        await turnsInput.fill(String(before.turns));
        await tokensInput.fill(String(tokens));
        await page.getByRole("button", { name: "Salva i limiti" }).click();
        await expect(page.getByTestId("caps-saved")).toHaveText("Limiti salvati.");
        expect(await configValue("ai.max_tokens_per_chat_turn")).toBe(tokens);
        await expect(page.getByLabel("Token massimi per turno di chat")).toHaveValue(String(tokens));
        await page.reload();
        await expect(page.getByLabel("Token massimi per turno di chat")).toHaveValue(String(tokens));
      } finally {
        await admin.from("app_config").update({ value: before.enabled }).eq("key", "ai.enabled").neq("value", before.enabled);
        await admin.from("app_config").update({ value: before.tokens }).eq("key", "ai.max_tokens_per_chat_turn");
        await admin.from("app_config").update({ value: before.turns }).eq("key", "ai.daily_chat_turns_per_user").neq("value", before.turns);
      }
    });

    // Audit log: this admin's kill-switch changes, newest first, with the changed field only.
    await page.goto("/admin");
    await page.getByRole("link", { name: /Registro delle modifiche/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Registro delle modifiche" })).toBeVisible();
    await page.getByLabel("Tabella", { exact: true }).selectOption("app_config");
    await page.getByLabel("Azione", { exact: true }).selectOption("UPDATE");
    await page.getByRole("button", { name: "Filtra" }).click();
    await expect(page).toHaveURL(/table=app_config/);
    await expect(page.getByTestId("audit-row").first()).toBeVisible();
    for (const row of await page.getByTestId("audit-row").all()) {
      await expect(row).toHaveAttribute("data-table", "app_config");
      await expect(row).toHaveAttribute("data-action", "UPDATE");
    }
    const mine = page.getByTestId("audit-row").filter({ has: page.getByTestId("audit-actor").filter({ hasText: email }) });
    const kill = mine.filter({ hasText: "ai.enabled" });
    await expect(kill).toHaveCount(2); // off, then on
    await expect(kill.first()).toContainText("Modifica");
    await kill.last().getByText(/campi cambiati|campo cambiato/).click();
    // Suspended first: value true -> false. updated_at / updated_by change too; nothing else is listed.
    const value = kill.last().getByTestId("audit-change").filter({ hasText: "value" });
    await expect(value).toBeVisible();
    await expect(value).toContainText(/true[\s\S]*false/);
    await expect(kill.last().getByTestId("audit-change").filter({ hasText: "description" })).toHaveCount(0);
    await expect(mine.filter({ hasText: "ai.max_tokens_per_chat_turn" })).toHaveCount(1);
    // The restore ran with the service role: no user, shown as "sistema".
    await expect(page.getByTestId("audit-actor").filter({ hasText: /^sistema$/ }).first()).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
    await page.screenshot({ path: `test-results/admin-audit-${project}.png`, fullPage: true });

    // A page past the end is an empty state, not an error.
    await page.goto("/admin/audit?table=app_config&page=9999");
    await expect(page.getByRole("heading", { name: "Nessuna voce con questi filtri" })).toBeVisible();
  } finally {
    await dropUser(userId);
  }
});

test("admin finds a user, makes them an analyst, and cannot change their own role", async ({ page }, info) => {
  const project = info.project.name;
  const seeded = await seedUser("ops-user");
  const { email, userId } = await signIn(page, "admin", "ops");
  try {
    await page.goto("/admin");
    await page.getByRole("link", { name: /Utenti e ruoli/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Utenti e ruoli" })).toBeVisible();
    await expect(page.getByText("Legge solo le schede e i brief pubblicati.")).toBeVisible();
    await expect(page.getByTestId("user-row").filter({ hasText: seeded.email })).toHaveCount(1);

    // Own row: no control at all.
    const own = page.getByTestId("user-row").filter({ hasText: email });
    await expect(own.getByTestId("user-role")).toHaveText("Amministratore");
    await expect(own.getByTestId("own-row")).toBeVisible();
    await expect(own.getByRole("combobox")).toHaveCount(0);

    // Search by email.
    await page.getByLabel("Cerca per email").fill(seeded.email.toUpperCase());
    await page.getByRole("button", { name: "Cerca" }).click();
    await expect(page).toHaveURL(/q=/);
    const row = page.getByTestId("user-row");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(seeded.email);
    await expect(row.getByTestId("user-role")).toHaveText("Membro");
    await expect(row).toContainText("Mai"); // never signed in

    // Choose, back out, choose again, confirm.
    const select = row.getByRole("combobox");
    await select.selectOption("analyst");
    await expect(row.getByText(`Cambiare il ruolo di ${seeded.email} da Membro a Analista?`)).toBeVisible();
    await row.getByRole("button", { name: "Annulla" }).click();
    await expect(select).toHaveValue("member");
    await select.selectOption("analyst");
    await page.screenshot({ path: `test-results/admin-users-confirm-${project}.png`, fullPage: true });
    await row.getByRole("button", { name: "Conferma" }).click();
    await expect(row.getByTestId("user-role")).toHaveText("Analista");
    const { data: m } = await admin.from("memberships").select("role").eq("user_id", seeded.userId).single();
    expect(m?.role).toBe("analyst");
    expect(await noOverflow(page)).toBe(true);
    await page.screenshot({ path: `test-results/admin-users-${project}.png`, fullPage: true });

    // No match.
    await page.goto("/admin/users?q=nobody-here-zzz");
    await expect(page.getByRole("heading", { name: "Nessun utente trovato" })).toBeVisible();

    // The role change is in the audit log, with who made it and who it was about.
    await page.goto("/admin/audit?table=memberships&action=UPDATE");
    const entry = page.getByTestId("audit-row").filter({ hasText: seeded.email });
    await expect(entry).toHaveCount(1);
    await expect(entry.getByTestId("audit-actor")).toHaveText(email);
    await entry.getByText("1 campo cambiato").click();
    await expect(entry.getByTestId("audit-change")).toContainText(/role[\s\S]*member[\s\S]*analyst/);
  } finally {
    await dropUser(seeded.userId);
    await dropUser(userId);
  }
});
