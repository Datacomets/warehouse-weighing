import { redirect } from "next/navigation";
import { getCurrentUserAndProfile } from "@/lib/supabase/server";

export default async function Index() {
  const { profile } = await getCurrentUserAndProfile();
  if (!profile) redirect("/login");

  switch (profile.role) {
    case "admin_sap":
      redirect("/admin");
    case "manager":
      redirect("/dashboard");
    case "admin":
      redirect("/users");
    default:
      redirect("/home");
  }
}
