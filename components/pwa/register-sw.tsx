"use client";
import { useEffect } from "react";

/** Registers the service worker (installability and the offline page). Production only. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Not installable then; the site still works.
    });
  }, []);
  return null;
}
