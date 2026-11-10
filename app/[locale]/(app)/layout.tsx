import { Nav } from "@/components/shell/nav";
import { requireUser } from "@/lib/auth";

// Signed-in screens are per user: never prerender or cache them.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <>
      <main className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-56">{children}</main>
      <Nav />
    </>
  );
}
