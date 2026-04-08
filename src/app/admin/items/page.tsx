import { redirect } from "next/navigation";
import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { TopAppBar } from "@/components/TopAppBar";
import { BottomNav } from "@/components/BottomNav";
import { ItemsAdmin } from "./ItemsAdmin";

export const dynamic = "force-dynamic";

export default async function ItemsMasterPage() {
  const { profile } = await getCurrentUserAndProfile();
  if (!profile) redirect("/login");
  if (!["admin", "admin_sap"].includes(profile.role)) redirect("/home");

  const supabase = createClient();
  const { data: items } = await supabase
    .from("item_master")
    .select("*")
    .order("item_code", { ascending: true })
    .limit(2000);

  return (
    <>
      <TopAppBar title="Item Master" subtitle="จัดการ Material จาก SAP" />
      <main className="mt-16 pb-32 px-4 flex flex-col gap-4">
        <ItemsAdmin initialItems={items || []} />
      </main>
      <BottomNav role={profile.role} />
    </>
  );
}
