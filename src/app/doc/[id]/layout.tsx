import { redirect, notFound } from "next/navigation";
import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { TopAppBar } from "@/components/TopAppBar";
import { StepNav } from "./StepNav";
import { StatusBadge } from "@/components/StatusBadge";
import { canEditDocumentData } from "@/lib/workflow";
import Link from "next/link";
import { isDocCanceler, isCancelableStatus, cancelReasonText } from "@/lib/cancelDocs";
import { fmtDateTime } from "@/lib/stats";
import { DOC_PHOTO_MAX } from "@/lib/docPhotos";

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
  const [{ data: weights }, { count: gridCount }, { count: photoCount }] = await Promise.all([
    supabase
      .from("weight_measurements")
      .select("kind")
      .eq("document_id", params.id),
    supabase
      .from("count_grid_entries")
      .select("*", { count: "exact", head: true })
      .eq("document_id", params.id),
    supabase
      .from("doc_item_photos")
      .select("*", { count: "exact", head: true })
      .eq("document_id", params.id),
  ]);

  const kinds = new Set((weights || []).map((w: any) => w.kind));
  const completed: Record<string, boolean> = {
    // header also needs all 4 product photos (บังคับถ่ายรูปสินค้าครบ 4 รูป)
    header: !!(doc.scale_name || doc.qty_per_carton || doc.gross_weight) && (photoCount || 0) >= DOC_PHOTO_MAX,
    "per-pcs": kinds.has("per_pcs") || !!doc.skip_per_pcs,
    "per-inner": kinds.has("per_inner") || !!doc.skip_per_inner,
    count: (gridCount || 0) > 0 || !!doc.skip_per_carton,
    // carton skipped → remainder is implicitly N/A and counted as done
    remainder: doc.remainder_pcs != null || !!doc.skip_per_carton,
    issues: true, // optional step — always "ok"
    submit: doc.status === "pending_sap" || doc.status === "completed",
  };

  const isCancelled = !!doc.cancelled_at;
  const canceler = await isDocCanceler(supabase, profile.id);
  let cancelledByName: string | null = null;
  if (isCancelled && doc.cancelled_by) {
    const { data: cb } = await supabase.from("profiles").select("full_name").eq("id", doc.cancelled_by).maybeSingle();
    cancelledByName = cb?.full_name ?? null;
  }
  const readOnly = !canEditDocumentData(profile.role, doc.status) || isCancelled;
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
        <StepNav
          docId={doc.id}
          completed={completed}
          photosMissing={doc.status === "in_progress" && !doc.cancelled_at && (photoCount || 0) < DOC_PHOTO_MAX}
        />
        {isCancelled && (
          <div className="bg-surface-container-high border-l-4 border-outline text-on-surface-variant text-xs px-3 py-2 rounded-lg mb-3">
            <b>ใบงานนี้ถูกยกเลิก</b> โดย {cancelledByName || "-"} · {fmtDateTime(doc.cancelled_at)}
            <br />
            เหตุผล: {cancelReasonText(doc.cancel_reason, doc.cancel_dup_wh, doc.cancel_note)}
            {canceler && (
              <>
                {" · "}
                <Link href="/cancel?tab=cancelled" className="underline font-bold">กู้คืนใบงาน</Link>
              </>
            )}
          </div>
        )}
        {readOnly && !isCancelled && (
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
        {canceler && !isCancelled && isCancelableStatus(doc.status) && (
          <div className="card mt-6 border border-error-container bg-[#fff8f7]">
            <p className="text-sm font-bold text-error">ยกเลิกใบงานนี้</p>
            <p className="text-[11px] text-outline mt-0.5">
              ยกเลิกได้เฉพาะใบงานที่ยังไม่นำเข้า SAP · ข้อมูลยังเก็บไว้และกู้คืนได้
            </p>
            <Link
              href={`/cancel?ids=${doc.id}`}
              className="mt-2 w-full rounded-xl py-2.5 font-bold text-error border-2 border-error flex items-center justify-center gap-2 text-sm"
            >
              เลือกเหตุผลและยกเลิก →
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
