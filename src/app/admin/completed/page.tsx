import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { TopAppBar } from "@/components/TopAppBar";
import { BottomNav } from "@/components/BottomNav";
import { DocumentCard } from "@/components/DocumentCard";

export default async function AdminCompletedPage() {
  const { profile } = await getCurrentUserAndProfile();
  if (!profile) redirect("/login");
  if (!["admin_sap", "admin"].includes(profile.role)) redirect("/home");

  const supabase = createClient();
  const { data: docs } = await supabase
    .from("gr_documents")
    .select("*")
    .eq("status", "completed")
    .order("closed_at", { ascending: false })
    .limit(50);

  return (
    <>
      <TopAppBar title="ประวัติการนำเข้า SAP" subtitle={profile.full_name} />
      <main className="mt-16 pb-32 px-4 flex flex-col gap-4">
        {(docs || []).map((d: any) => (
          <Link key={d.id} href={`/admin/${d.id}`}>
            <DocumentCard doc={d} />
          </Link>
        ))}
      </main>
      <BottomNav role={profile.role} />
    </>
  );
}
