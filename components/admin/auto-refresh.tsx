"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

/** Mounted only while a run is queued or running; unmounts (stops) when the list has none. */
export function AutoRefresh() {
  const router = useRouter();
  const t = useTranslations("admin.runs");
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(id);
  }, [router]);
  return <p className="text-sm text-muted">{t("refreshing")}</p>;
}
