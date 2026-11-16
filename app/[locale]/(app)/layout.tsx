import { ScoutIntroGate } from "@/components/cell/scout-intro";
import { Header } from "@/components/shell/header";
import { GuidedTour } from "@/components/tour/guided-tour";
import { requireUser } from "@/lib/auth";

// Signed-in screens are per user: never prerender or cache them.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await requireUser();
  return (
    <div style={{ "--header-h": "calc(5rem + env(safe-area-inset-top))" } as React.CSSProperties}>
      <ScoutIntroGate />
      <Header />
      <main className="min-h-dvh pt-[var(--header-h)]">{children}</main>
      <GuidedTour userId={userId} />
    </div>
  );
}
