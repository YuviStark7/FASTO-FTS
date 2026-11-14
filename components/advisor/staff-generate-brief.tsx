import "server-only";
import { getStaffRole } from "@/lib/admin";
import { GenerateBriefButton } from "./generate-brief-button";

/** Server wrapper: renders the generate button for analysts and admins, nothing for anyone else. */
export async function StaffGenerateBrief(props: React.ComponentProps<typeof GenerateBriefButton>) {
  const { role } = await getStaffRole();
  if (!role) return null;
  return <GenerateBriefButton {...props} />;
}
