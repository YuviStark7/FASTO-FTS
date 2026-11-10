"use client";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Cloudflare Turnstile captcha, required by Supabase Auth when captcha protection is on. */
export function Turnstile({ siteKey, onToken, label }: { siteKey: string; onToken: (t: string | null) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let widgetId: string | undefined;
    const mount = () => {
      if (!ref.current || !window.turnstile) return;
      widgetId = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        theme: document.documentElement.dataset.theme === "light" ? "light" : "dark",
        callback: (t: string) => onToken(t),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
      });
    };
    if (window.turnstile) mount();
    else {
      let s = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
      if (!s) {
        s = document.createElement("script");
        s.src = SCRIPT_SRC;
        s.async = true;
        document.head.appendChild(s);
      }
      s.addEventListener("load", mount, { once: true });
    }
    return () => {
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey, onToken]);

  return <div ref={ref} aria-label={label} className="min-h-[65px]" />;
}
