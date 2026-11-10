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
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <span aria-hidden className="grid size-14 place-items-center rounded-full bg-brand text-lg font-bold text-brand-contrast">
          FT
        </span>
        <h1 className="text-4xl font-light tracking-tight">{t("title")}</h1>
        <p className="text-muted">{t("lead")}</p>
      </div>
      <LoginForm next={safeNext} linkError={error === "link"} />
    </main>
  );
}
