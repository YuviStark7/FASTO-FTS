"use client";
import { ArrowUp, CircleAlert, CircleDashed, MessageSquarePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { askAction } from "@/app/[locale]/(app)/ask/actions";
import type { StoredAnswer } from "@/lib/advisor/content";
import { AnswerCard } from "./answer-card";

export type AskMessage = { kind: "user"; text: string } | { kind: "answer"; answer: StoredAnswer } | { kind: "unreadable" };

type ErrorReason = "disabled" | "global_limit" | "user_limit" | "model_failed" | "bad_input" | "network";
const STARTERS = ["s1", "s2", "s3", "s4"] as const;
const MAX_LENGTH = 2000;

export function AskView({ locale, initialConversationId, initialMessages }: { locale: "it" | "en"; initialConversationId: number | null; initialMessages: AskMessage[] }) {
  const t = useTranslations("ask");
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState<string | null>(null);
  const [error, setError] = useState<ErrorReason | null>(null);
  const [pending, start] = useTransition();
  const inputId = useId();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ block: "end", behavior: calm ? "auto" : "smooth" });
  }, [messages.length, asking, error]);

  function send(raw: string) {
    const question = raw.trim();
    if (!question || pending) return;
    setError(null);
    setAsking(question);
    setDraft("");
    start(async () => {
      try {
        const r = await askAction(conversationId, question, locale);
        if (r.turn.ok) {
          const { answer, facts, checked } = r.turn;
          setConversationId(r.conversationId);
          setMessages((m) => [...m, { kind: "user", text: question }, { kind: "answer", answer: { sentences: answer.sentences, followUps: answer.follow_ups, facts, checked } }]);
        } else {
          setError(r.turn.reason);
          setDraft(question); // nothing was stored: hand the question back
        }
      } catch {
        setError("network");
        setDraft(question);
      } finally {
        setAsking(null);
      }
    });
  }

  function reset() {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setDraft("");
    inputRef.current?.focus();
  }

  const empty = messages.length === 0 && !asking;
  const lastAnswer = messages.findLastIndex((m) => m.kind === "answer");

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-var(--header-h))] w-full max-w-3xl flex-col px-4 lg:px-8">
      <header className="flex items-start justify-between gap-3 pt-5 pb-4 lg:pt-8">
        <div className="space-y-1">
          <h1 className="t-h1">{t("title")}</h1>
          <p className="t-lead text-sm">{t("lead")}</p>
        </div>
        {!empty && (
          <button type="button" onClick={reset} disabled={pending} className="btn btn-quiet shrink-0 px-4" aria-label={t("newConversation")}>
            <MessageSquarePlus aria-hidden className="size-4" />
            <span className="hidden sm:inline">{t("newConversation")}</span>
          </button>
        )}
      </header>

      <div className="flex-1 space-y-4 pb-6">
        {empty && (
          <section aria-labelledby={`${inputId}-starters`} className="pt-4 sm:pt-10" data-testid="ask-empty">
            <h2 id={`${inputId}-starters`} className="t-label mb-3">{t("startersTitle")}</h2>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {STARTERS.map((k) => (
                <li key={k}>
                  <button type="button" onClick={() => send(t(`starters.${k}`))} className="card card-link flex min-h-16 w-full items-center p-4 text-left text-sm leading-snug">
                    {t(`starters.${k}`)}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs leading-relaxed text-muted">{t("scopeNote")}</p>
          </section>
        )}

        <ol className="space-y-4" aria-label={t("conversation")}>
          {messages.map((m, i) => (
            <li key={i} className={m.kind === "user" ? "flex justify-end" : ""}>
              {m.kind === "user" && <UserBubble label={t("you")} text={m.text} />}
              {m.kind === "answer" && (
                <>
                  <span className="sr-only">{t("assistant")}</span>
                  <AnswerCard answer={m.answer} scope={`m${i}`} onFollowUp={i === lastAnswer && !asking ? send : undefined} disabled={pending} />
                </>
              )}
              {m.kind === "unreadable" && (
                <p className="hatched flex items-center gap-2 rounded-[var(--radius-card)] border border-border-strong/60 px-4 py-3 text-sm">
                  <CircleDashed aria-hidden className="size-4 shrink-0" />
                  {t("unreadable")}
                </p>
              )}
            </li>
          ))}
          {asking && (
            <>
              <li className="flex justify-end">
                <UserBubble label={t("you")} text={asking} />
              </li>
              <li>
                <div role="status" aria-busy="true" className="card space-y-3 p-4 sm:p-5" data-testid="answer-pending">
                  <p className="text-sm text-muted">{t("sending")}</p>
                  <div className="skeleton h-3 w-11/12" />
                  <div className="skeleton h-3 w-8/12" />
                </div>
              </li>
            </>
          )}
        </ol>

        {error && (
          <div role="alert" data-testid="ask-error" className="flex items-start gap-3 rounded-[var(--radius-card)] border border-threatened/60 bg-surface p-4">
            <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-threatened" />
            <div className="space-y-1">
              <p className="text-sm font-medium">{t(`errors.${error}.title`)}</p>
              <p className="text-sm text-muted">{t(`errors.${error}.body`)}</p>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="sticky bottom-0 -mx-4 bg-gradient-to-t from-bg from-70% to-transparent px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] lg:-mx-8 lg:px-8"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <div className="flex items-end gap-2 rounded-[var(--radius-tray)] border border-border bg-surface p-2 pl-4 shadow-e3 focus-within:border-border-strong">
          <label htmlFor={inputId} className="sr-only">{t("inputLabel")}</label>
          <textarea
            id={inputId}
            ref={inputRef}
            value={draft}
            rows={1}
            maxLength={MAX_LENGTH}
            placeholder={t("placeholder")}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(draft);
              }
            }}
            className="field-sizing-content max-h-40 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-[16px] leading-6 outline-none placeholder:text-muted"
          />
          <button type="submit" disabled={pending || !draft.trim()} aria-label={pending ? t("sending") : t("send")} className="btn btn-primary size-11 shrink-0 p-0">
            <ArrowUp aria-hidden strokeWidth={2.25} className="size-5" />
          </button>
        </div>
      </form>
    </div>
  );
}

function UserBubble({ label, text }: { label: string; text: string }) {
  return (
    <div className="max-w-[85%] rounded-[var(--radius-card)] rounded-br-md bg-surface-2 px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap" data-testid="question">
      <span className="sr-only">{label}: </span>
      {text}
    </div>
  );
}
