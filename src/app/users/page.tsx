import { redirect } from "next/navigation";
import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { TopAppBar } from "@/components/TopAppBar";
import { BottomNav } from "@/components/BottomNav";
import { UsersAdmin } from "./UsersAdmin";

export default async function UsersPage() {
  const { profile } = await getCurrentUserAndProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/home");

  const supabase = createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <>
      <TopAppBar title="จัดการผู้ใช้" subtitle={profile.full_name} />
      <main className="mt-16 pb-32 px-4">
        <UsersAdmin users={(users || []) as any} />
      </main>
      <BottomNav role={profile.role} />
    </>
  );
}
