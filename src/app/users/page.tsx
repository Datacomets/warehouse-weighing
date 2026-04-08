import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { TopAppBar } from "@/components/TopAppBar";
import { BottomNav } from "@/components/BottomNav";
import { Icon } from "@/components/Icon";
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
      <main className="mt-16 pb-32 px-4 flex flex-col gap-4">
        <Link
          href="/admin/items"
          className="card flex items-center gap-3 hover:bg-surface-container-high"
        >
          <Icon name="inventory_2" className="text-primary text-2xl" />
          <div className="flex-1">
            <div className="text-sm font-bold">Item Master</div>
            <div className="text-[11px] text-outline">
              นำเข้า / จัดการ Material จาก SAP
            </div>
          </div>
          <Icon name="chevron_right" className="text-outline" />
        </Link>

        <UsersAdmin users={(users || []) as any} />
      </main>
      <BottomNav role={profile.role} />
    </>
  );
}
