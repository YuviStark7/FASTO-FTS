import { setRequestLocale } from "next-intl/server";
import { getStaffRole } from "@/lib/admin";
import { NotAllowed } from "@/components/admin/not-allowed";

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { role } = await getStaffRole();
  if (!role) return <NotAllowed />;
  return <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 lg:px-8">{children}</div>;
}
