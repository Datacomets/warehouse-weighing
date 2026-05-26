import { redirect, notFound } from "next/navigation";
import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { TopAppBar } from "@/components/TopAppBar";
import { StepNav } from "./StepNav";
import { StatusBadge } from "@/components/StatusBadge";
import { canEditDocumentData } from "@/lib/workflow";

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

  // ตรวจว่า step ไหนมีข้อมูลแล้ว
  const [{ data: weights }, { count: gridCount }] = await Promise.all([
    supabase
      .from("weight_measurements")
      .select("kind")
      .eq("document_id", params.id),
    supabase
      .from("count_grid_entries")
      .select("*", { count: "exact", head: true })
      .eq("document_id", params.id),
  ]);

  const kinds = new Set((weights || []).map((w: any) => w.kind));
  const completed: Record<string, boolean> = {
    header: !!(doc.scale_name || doc.qty_per_carton || doc.gross_weight),
    "per-pcs": kinds.has("per_pcs") || !!doc.skip_per_pcs,
    "per-inner": kinds.has("per_inner") || !!doc.skip_per_inner,
    count: (gridCount || 0) > 0 || !!doc.skip_per_carton,
    // carton skipped → remainder is implicitly N/A and counted as done
    remainder: doc.remainder_pcs != null || !!doc.skip_per_carton,
    issues: true, // optional step — always "ok"
    submit: doc.status === "pending_sap" || doc.status === "completed",
  };

  const readOnly = !canEditDocumentData(profile.role, doc.status);
  const isAdminEditingCompleted =
    doc.status === "completed" && canEditDocumentData(profile.role, doc.status);

  return (
    <>
      <TopAppBar
        title={doc.wh_number}
        subtitle={doc.description || "เอกสารตรวจรับสินค้า"}
        showBack
        rightSlot={<StatusBadge status={doc.status} />}
      />
      <main className="mt-16 pb-32 px-4">
        <StepNav docId={doc.id} completed={completed} />
        {readOnly && (
          <div className="bg-secondary-container/60 border border-outline-variant/30 text-on-secondary-container text-xs px-3 py-2 rounded-lg mb-3">
            เอกสารนี้ถูกล็อก (Status: {doc.status}). ขอให้ Admin "ปลดล็อก" หากต้องการแก้ไข
          </div>
        )}
        {isAdminEditingCompleted && (
          <div className="bg-tertiary-container/40 border border-tertiary-fixed-dim/40 text-on-tertiary-container text-xs px-3 py-2 rounded-lg mb-3">
            ⚠ เอกสารนี้ <b>นำเข้า SAP แล้ว</b> — การแก้ไขจะไม่เปลี่ยนสถานะกลับ แต่ระบบจะบันทึก audit log ทุกครั้ง
          </div>
        )}
        {children}
      </main>
    </>
  );
}
