import { redirect, notFound } from "next/navigation";
import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { TopAppBar } from "@/components/TopAppBar";
import { StepNav } from "./StepNav";
import { StatusBadge } from "@/components/StatusBadge";

export default async function DocLayout({
  params,
  children,
}: {
  params: { id: string };
  children: React.ReactNode;
}) {
  const { profile } = await getCurrentUserAndProfile();
  if (!profile) redirect("/login");

  const supabase = createClient();
  const { data: doc } = await supabase
    .from("gr_documents")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!doc) notFound();

  const readOnly = doc.status !== "in_progress";

  return (
    <>
      <TopAppBar
        title={doc.wh_number}
        subtitle={doc.description || "เอกสารตรวจรับสินค้า"}
        showBack
        rightSlot={<StatusBadge status={doc.status} />}
      />
      <main className="mt-16 pb-32 px-4">
        <StepNav docId={doc.id} />
        {readOnly && (
          <div className="bg-secondary-container/60 border border-outline-variant/30 text-on-secondary-container text-xs px-3 py-2 rounded-lg mb-3">
            เอกสารนี้ถูกล็อก (Status: {doc.status}). ขอให้ Admin "ปลดล็อก" หากต้องการแก้ไข
          </div>
        )}
        {children}
      </main>
    </>
  );
}
