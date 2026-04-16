import { redirect } from "next/navigation";
import { getCurrentUserAndProfile } from "@/lib/supabase/server";
import { homeRouteFor } from "@/lib/permissions";

export default async function Index() {
  const { profile } = await getCurrentUserAndProfile();
  if (!profile) redirect("/login");
  redirect(homeRouteFor(profile.role));
}
