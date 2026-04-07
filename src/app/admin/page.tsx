import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { TopAppBar } from "@/components/TopAppBar";
import { BottomNav } from "@/components/BottomNav";
import { DocumentCard } from "@/components/DocumentCard";
import { Icon } from "@/components/Icon";

export default async function AdminPage() {
  const { profile } = await getCurrentUserAndProfile();
  if (!profile) redirect("/login");
  if (!["admin_sap", "admin", "qc"].includes(profile.role)) redirect("/home");

  const supabase = createClient();
  const { data: pending } = await supabase
    .from("gr_documents")
    .select("*")
    .eq("status", "pending_sap")
    .order("submitted_at", { ascending: false });

  return (
    <>
      <TopAppBar
        title="Admin SAP — งานคิว"
        subtitle={profile.full_name}
        rightSlot={
          <form action="/api/logout" method="post">
            <button className="p-2 rounded-full hover:bg-surface-container-high">
              <Icon name="logout" className="text-primary" />
            </button>
          </form>
        }
      />
      <main className="mt-16 pb-32 px-4 flex flex-col gap-4">
        <div className="card border-l-4 border-primary-container">
          <span className="section-title">รอนำเข้า SAP</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-headline font-bold text-primary">
              {pending?.length || 0}
            </span>
            <span className="text-xs text-outline">เอกสาร</span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {(pending || []).length === 0 && (
            <div className="card text-center text-outline py-12">
              <Icon name="inbox" className="text-4xl mb-2" />
              <p className="text-sm">ไม่มีงานในคิว</p>
            </div>
          )}
          {(pending || []).map((d: any) => (
            <Link key={d.id} href={`/admin/${d.id}`}>
              <DocumentCard doc={d} />
            </Link>
          ))}
        </div>
      </main>
      <BottomNav role={profile.role} />
    </>
  );
}
