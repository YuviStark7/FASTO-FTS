import { test, expect, type Page } from "@playwright/test";
import { admin, signIn } from "./helpers";
import { insertConversation, storedTurn, unavailableTurn } from "./advisor-fixtures";

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("empty state offers starter questions; a reached daily cap is explained and keeps the question", async ({ page }, info) => {
  const { userId } = await signIn(page, "member", "ask");
  try {
    await page.goto("/ask");
    await expect(page.getByRole("heading", { level: 1, name: "Chiedi" })).toBeVisible();
    const starters = page.getByTestId("ask-empty").getByRole("button");
    await expect(starters).toHaveCount(4);
    await expect(page.getByRole("textbox", { name: "La tua domanda" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Invia la domanda" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Nuova conversazione" })).toHaveCount(0);
    expect(await noOverflow(page)).toBe(true);
    await page.screenshot({ path: `test-results/ask-empty-${info.project.name}.png` });

    // Use up this user's own daily allowance, so the refusal does not depend on a model key.
    const { data: cap } = await admin.from("app_config").select("value").eq("key", "ai.daily_chat_turns_per_user").single();
    const { error } = await admin.from("usage").insert(Array.from({ length: Number(cap!.value) }, () => ({ user_id: userId, module: "chat", kind: "chat_turn" })));
    if (error) throw error;

    const question = await starters.first().innerText();
    await starters.first().click();
    const alert = page.getByTestId("ask-error");
    await expect(alert).toContainText("Hai raggiunto il limite giornaliero di domande");
    await expect(page.getByRole("textbox", { name: "La tua domanda" })).toHaveValue(question);
    await expect(page.getByTestId("answer")).toHaveCount(0);
    await page.screenshot({ path: `test-results/ask-limit-${info.project.name}.png` });

    // English strings.
    await page.goto("/en/ask");
    await expect(page.getByRole("heading", { level: 1, name: "Ask" })).toBeVisible();
    await expect(page.getByText("Try one of these questions")).toBeVisible();
  } finally {
    await admin.from("usage").delete().eq("user_id", userId);
  }
});

test("a stored conversation is rendered with citation chips, graded facts and follow-ups", async ({ page }, info) => {
  const { userId } = await signIn(page, "member", "ask");
  const { conversationId } = await insertConversation(userId, [
    { question: "Quanto costerà l'olio a Tokyo l'anno prossimo?", turn: unavailableTurn },
    { question: "Com'è il mercato dei formaggi a Roma?", turn: storedTurn },
  ]);
  try {
    await page.goto("/ask");
    await expect(page.getByTestId("question")).toHaveCount(2);
    await expect(page.getByTestId("question").nth(1)).toContainText("formaggi a Roma");

    // Unavailable: the hatched "no data" treatment, no figures, no chips.
    const unavailable = page.getByTestId("answer-unavailable");
    await expect(unavailable).toContainText("Dati non disponibili");
    await expect(unavailable.getByTestId("fact-chip")).toHaveCount(0);

    // Checked answer: chips beside the sentences, facts with grade badges, the checked mark.
    const answer = page.getByTestId("answer");
    await expect(answer).toHaveCount(1);
    await expect(answer.getByTestId("cited-sentence")).toHaveCount(2);
    await expect(answer.getByTestId("fact-chip")).toHaveText(["T1A", "T2C"]);
    await expect(answer.getByTestId("answer-checked")).toContainText("Controllata");
    const facts = answer.getByTestId("fact");
    await expect(facts).toHaveCount(2);
    await expect(facts.nth(0).locator(".grade-A")).toBeVisible();
    await expect(facts.nth(1).locator(".grade-C")).toBeVisible();
    await expect(facts.nth(1)).toContainText("indicativo");
    await expect(facts.nth(0)).toContainText("Eurostat");

    await answer.getByTestId("fact-chip").nth(1).click();
    await expect(page.locator("#m3-T2")).toBeFocused();

    await expect(answer.getByRole("button", { name: "E a Milano?" })).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
    await page.screenshot({ path: `test-results/ask-conversation-${info.project.name}.png`, fullPage: true });

    // New conversation clears the thread and brings the starters back.
    await page.getByRole("button", { name: "Nuova conversazione" }).click();
    await expect(page.getByTestId("ask-empty")).toBeVisible();
    await expect(page.getByTestId("question")).toHaveCount(0);
  } finally {
    await admin.from("conversations").delete().eq("id", conversationId);
  }
});
