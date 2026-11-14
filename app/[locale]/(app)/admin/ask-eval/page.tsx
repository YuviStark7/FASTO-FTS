import { getTranslations, setRequestLocale } from "next-intl/server";
import { AskEvalRunner } from "@/components/advisor/ask-eval-runner";
import { NotAllowed } from "@/components/admin/not-allowed";
import { getStaffRole } from "@/lib/admin";

// Ten chat turns run one after the other inside the server action.
export const maxDuration = 300;

export default async function AskEvalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, { role }] = await Promise.all([getTranslations("askEval"), getStaffRole()]);
  // The action is admin only: analysts get the same not-allowed state.
  if (role !== "admin") return <NotAllowed />;
  return (
    <>
      <header className="page-header">
        <h1 className="t-h1">{t("title")}</h1>
        <p className="t-lead">{t("lead")}</p>
      </header>
      <AskEvalRunner />
    </>
  );
}
