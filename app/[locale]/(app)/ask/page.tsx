import { getTranslations, setRequestLocale } from "next-intl/server";
import { Placeholder } from "@/components/shell/placeholder";

export default async function AskPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const [nav, p] = await Promise.all([getTranslations("nav"), getTranslations("placeholder")]);
  return <Placeholder title={nav("ask")} body={p("ask")} />;
}
