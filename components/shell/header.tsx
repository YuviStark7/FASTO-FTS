import { requireUser } from "@/lib/auth";
import { getStaffRole } from "@/lib/admin";
import { cookies } from "next/headers";
import { PageChip } from "./page-chip";
import { ProfileMenu } from "./profile-menu";

/** Server part: reads the user and role, hands plain props to the client pieces. */
export async function Header() {
  const { email } = await requireUser();
  const { role } = await getStaffRole();
  const theme = (await cookies()).get("theme")?.value === "light" ? "light" : "dark";
  // Transparent header over a scrim that fades the page out under the chip, so scrolled content never collides with it.
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[var(--header-h)] px-3 pt-[calc(env(safe-area-inset-top)+1rem)] before:absolute before:inset-x-0 before:top-0 before:-z-10 before:h-full before:bg-gradient-to-b before:from-bg before:from-55% before:via-bg/90 before:via-80% before:to-transparent sm:px-4">
      <div className="relative mx-auto flex max-w-[1600px] items-start justify-center">
        <PageChip />
        <div className="pointer-events-auto absolute right-0 top-0">
          <ProfileMenu email={email} isStaff={role !== null} theme={theme} />
        </div>
      </div>
    </header>
  );
}
