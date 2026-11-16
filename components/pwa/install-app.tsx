"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/**
 * "Install the app": uses the browser's install prompt where there is one (Chrome, Edge, Android),
 * explains Share → Add to Home Screen on iOS Safari, and says so when the app is already installed.
 */
export function InstallApp() {
  const t = useTranslations("pwa");
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [state, setState] = useState<"unknown" | "installed" | "ios" | "available" | "unsupported">("unknown");

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return setState("installed");
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    setState(ios ? "ios" : "unsupported");
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
      setState("available");
    };
    const onInstalled = () => {
      setPrompt(null);
      setState("installed");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (state === "unknown") return null;
  return (
    <section className="card space-y-3 p-5" data-testid="install-app" data-state={state}>
      <h2 className="t-label">{t("title")}</h2>
      {state === "available" && prompt && (
        <button
          type="button"
          className="btn btn-ghost h-11 w-full"
          onClick={async () => {
            await prompt.prompt();
            const { outcome } = await prompt.userChoice;
            if (outcome === "accepted") setState("installed");
            setPrompt(null);
          }}
        >
          <Download aria-hidden className="size-4" />
          {t("install")}
        </button>
      )}
      {state === "installed" && <p className="text-sm text-muted">{t("installed")}</p>}
      {state === "ios" && <p className="text-sm text-muted">{t("ios")}</p>}
      {state === "unsupported" && <p className="text-sm text-muted">{t("unsupported")}</p>}
    </section>
  );
}
