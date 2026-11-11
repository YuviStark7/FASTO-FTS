import { setRequestLocale } from "next-intl/server";
import { getMatrixData } from "@/lib/queries/matrix";
import { MatrixView } from "@/components/matrix/matrix-view";

export default async function MatrixPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const data = await getMatrixData();
  return <MatrixView {...data} />;
}
