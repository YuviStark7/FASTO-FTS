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
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[var(--header-h)] px-3 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <div className="relative mx-auto flex max-w-[1600px] items-start justify-center">
        <PageChip />
        <div className="pointer-events-auto absolute right-0 top-0">
          <ProfileMenu email={email} isStaff={role !== null} theme={theme} />
        </div>
      </div>
    </header>
  );
}
