"use server";
import type Anthropic from "@anthropic-ai/sdk";
import type { Json } from "@/lib/database.types";
import { requireUser } from "@/lib/auth";
import { getStaffRole } from "@/lib/admin";
import { numbersIn } from "@/lib/ai/brief/citation-check";
import type { Fact } from "@/lib/ai/brief/types";
import { chatTurn, type ChatTurn } from "@/lib/ai/chat/orchestrator";
import { gradeTurn, REFERENCE_QUESTIONS, type ReferenceResult } from "@/lib/ai/chat/reference-questions";

const HISTORY_MESSAGES = 6;

type StoredUser = { text: string };
type StoredAssistant = Extract<ChatTurn, { ok: true }>;

export type AskResult = { conversationId: number | null; turn: ChatTurn };

/**
 * One Ask turn. Conversations and messages are stored with the user's own client (RLS: owner only).
 * Earlier turns are replayed as plain text, so only checked answers ever re-enter the context.
 */
export async function askAction(conversationId: number | null, question: string, locale: "it" | "en"): Promise<AskResult> {
  if (locale !== "it" && locale !== "en") return { conversationId, turn: { ok: false, reason: "bad_input" } };
  const { supabase, userId } = await requireUser();

  let history: Anthropic.MessageParam[] = [];
  if (conversationId != null) {
    const { data: rows } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("id", { ascending: false })
      .limit(HISTORY_MESSAGES);
    history = (rows ?? [])
      .reverse()
      .map((m): Anthropic.MessageParam => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.role === "user" ? (m.content as StoredUser).text : (m.content as StoredAssistant).answer.sentences.map((s) => s.text).join(" "),
      }));
    if (history[0]?.role === "assistant") history = history.slice(1);
  }

  const turn = await chatTurn(question, history, locale);
  if (!turn.ok) return { conversationId, turn };

  const { data: mem } = await supabase.from("memberships").select("org_id, role, created_at").eq("user_id", userId).order("created_at", { ascending: true });
  const orgId = (mem ?? []).find((m) => m.role !== "viewer")?.org_id ?? mem?.[0]?.org_id;
  if (orgId) {
    let id = conversationId;
    if (id == null) {
      const { data: conv } = await supabase.from("conversations").insert({ org_id: orgId, user_id: userId, title: question.slice(0, 120), locale }).select("id").single();
      id = conv?.id ?? null;
    }
    if (id != null) {
      await supabase.from("messages").insert([
        { conversation_id: id, org_id: orgId, role: "user", content: { text: question } },
        { conversation_id: id, org_id: orgId, role: "assistant", content: JSON.parse(JSON.stringify(turn)) as { [key: string]: Json } },
      ]);
      return { conversationId: id, turn };
    }
  }
  return { conversationId, turn };
}

/** Runs the ten reference questions (admins only). Uses the admin's own chat allowance. */
export async function runReferenceQuestions(): Promise<{ ok: boolean; results: (ReferenceResult & { question: string; answer: string; sentences: { text: string; facts: string[] }[]; facts: Fact[] })[] }> {
  const { role } = await getStaffRole();
  if (role !== "admin") return { ok: false, results: [] };
  const results = [];
  for (const q of REFERENCE_QUESTIONS) {
    const turn = await chatTurn(q.question, [], q.locale);
    if (!turn.ok) {
      results.push({ id: q.id, passed: false, reasons: [`turn failed: ${turn.reason}`], question: q.question, answer: "", sentences: [], facts: [] });
      continue;
    }
    results.push({ ...gradeTurn(q, turn, numbersIn), question: q.question, answer: turn.answer.sentences.map((s) => s.text).join(" "), sentences: turn.answer.sentences, facts: turn.facts });
  }
  return { ok: true, results };
}
