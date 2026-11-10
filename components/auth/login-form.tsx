"use client";
import { useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { env } from "@/lib/env";
import { Turnstile } from "./turnstile";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; email: string } | { kind: "error" };

export function LoginForm({ next, linkError }: { next: string; linkError: boolean }) {
  const t = useTranslations("login");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  const needsCaptcha = Boolean(env.turnstileSiteKey);
  const onToken = useCallback((tok: string | null) => setCaptcha(tok), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "sending" });
    const localNext = locale === "en" ? `/en${next === "/" ? "" : next}` || "/en" : next;
    const redirect = new URL("/auth/confirm", window.location.origin);
    redirect.searchParams.set("next", localNext);
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirect.toString(),
        shouldCreateUser: true, // open sign-up (SPEC section 11)
        captchaToken: captcha ?? undefined,
        data: { locale },
      },
    });
    setState(error ? { kind: "error" } : { kind: "sent", email });
  }

  if (state.kind === "sent") {
    return (
      <p role="status" className="rounded-[var(--radius-card)] bg-surface-2 p-5 text-base">
        {t("sent", { email: state.email })}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate={false}>
      {linkError && (
        <p role="alert" className="rounded-xl bg-surface-2 p-3 text-sm text-threatened">
          {t("linkError")}
        </p>
      )}
      <label className="flex flex-col gap-2 text-sm text-muted">
        {t("email")}
        <input
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 rounded-xl border border-border bg-surface-2 px-4 text-base text-text placeholder:text-muted"
        />
      </label>
      {needsCaptcha && <Turnstile siteKey={env.turnstileSiteKey} onToken={onToken} label={t("captcha")} />}
      <button
        type="submit"
        disabled={state.kind === "sending" || (needsCaptcha && !captcha)}
        className="h-12 rounded-full bg-brand font-medium text-brand-contrast transition-opacity disabled:opacity-50"
      >
        {state.kind === "sending" ? t("sending") : t("submit")}
      </button>
      {state.kind === "error" && (
        <p role="alert" className="text-sm text-threatened">
          {t("error")}
        </p>
      )}
      <p className="text-xs text-muted">{t("privacy")}</p>
    </form>
  );
}
