import { setRequestLocale } from "next-intl/server";
import { AskView, type AskMessage } from "@/components/advisor/ask-view";
import { parseStoredAnswer, parseStoredQuestion } from "@/lib/advisor/content";
import { requireUser } from "@/lib/auth";

// One chat turn runs several model rounds inside the server action.
export const maxDuration = 120;

export default async function AskPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, userId } = await requireUser();

  // The user's latest conversation. RLS already limits both tables to the owner.
  const { data: conv, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  let messages: AskMessage[] = [];
  if (conv) {
    const { data: rows, error: e } = await supabase.from("messages").select("id, role, content").eq("conversation_id", conv.id).order("id", { ascending: true });
    if (e) throw e;
    messages = (rows ?? [])
      .filter((r) => r.role !== "tool")
      .map((r): AskMessage => {
        if (r.role === "user") {
          const text = parseStoredQuestion(r.content);
          return text == null ? { kind: "unreadable" } : { kind: "user", text };
        }
        const answer = parseStoredAnswer(r.content);
        return answer ? { kind: "answer", answer } : { kind: "unreadable" };
      });
  }

  return <AskView locale={locale === "en" ? "en" : "it"} initialConversationId={conv?.id ?? null} initialMessages={messages} />;
}
