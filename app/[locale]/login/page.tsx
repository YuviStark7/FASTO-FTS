import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next, error } = await searchParams;
  const t = await getTranslations("login");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm animate-[fade_var(--dur-slow)_var(--ease-out)] flex-col justify-center gap-10 px-5 py-10">
      <div className="flex flex-col items-center gap-5 text-center">
        <span aria-hidden className="grid size-16 place-items-center rounded-full bg-brand text-lg font-bold tracking-[0.04em] text-brand-contrast shadow-e3 ring-1 ring-white/20 ring-inset">
          FT
        </span>
        <h1 className="t-h1">{t("title")}</h1>
        <p className="t-lead">{t("lead")}</p>
      </div>
      <LoginForm next={safeNext} linkError={error === "link"} />
    </main>
  );
}
