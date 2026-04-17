import { notFound } from "next/navigation";
import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { SubmitPanel } from "./SubmitPanel";
import { SectionHeader } from "@/components/Field";
import { fmtDateTime, leadTimeText } from "@/lib/stats";
import { computeSubmitChecklist } from "@/lib/submitChecklist";
import Link from "next/link";
import { Icon } from "@/components/Icon";

export default async function SubmitPage({ params }: { params: { id: string } }) {
  const { profile } = await getCurrentUserAndProfile();
  const supabase = createClient();
  const { data: doc } = await supabase
    .from("gr_documents")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!doc) notFound();

  const { data: items } = await supabase
    .from("weight_measurements")
    .select("kind")
    .eq("document_id", params.id);
  const { count: gridCount } = await supabase
    .from("count_grid_entries")
    .select("*", { count: "exact", head: true })
    .eq("document_id", params.id);

  const { hasPcs, hasInner, hasCarton, hasRemainder, hasAll } = computeSubmitChecklist({
    measurementKinds: (items || []).map((i: any) => i.kind),
    gridCount: gridCount || 0,
    remainderPcs: doc.remainder_pcs,
  });

  const qtyPerCarton = Number(doc.qty_per_carton) || 0;
  const fullCartons = gridCount || 0;
  const remainderPcs = Number(doc.remainder_pcs) || 0;
  const totalPcs = qtyPerCarton * fullCartons + remainderPcs;

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader icon="send" title="ส่งงานเพื่อนำเข้า SAP" accent />

      <div className="card">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><b>เลขเอกสาร:</b> {doc.wh_number}</div>
          <div><b>Status:</b> {doc.status}</div>
          <div><b>เริ่มเมื่อ:</b> {fmtDateTime(doc.started_at)}</div>
          <div>
            <b>Lead Time:</b>{" "}
            {leadTimeText(doc.started_at, doc.ended_at || new Date().toISOString())}
          </div>
        </div>
      </div>

      <div className="card">
        <span className="section-title">Checklist ก่อนส่งงาน</span>
        <ul className="mt-2 text-sm flex flex-col gap-1">
          <li className={hasPcs ? "text-success" : "text-error"}>
            {hasPcs ? "✓" : "✗"} ชั่ง Per Pcs
          </li>
          <li className={hasInner ? "text-success" : "text-error"}>
            {hasInner ? "✓" : "✗"} ชั่ง Per Inner/Tray/Bag
          </li>
          <li className={hasCarton ? "text-success" : "text-error"}>
            {hasCarton ? "✓" : "✗"} ชั่ง Per Carton (Grid)
          </li>
          <li className={hasRemainder ? "text-success" : "text-error"}>
            {hasRemainder ? "✓" : "✗"} นับเศษ (Remainder)
          </li>
        </ul>
      </div>

      {/* สรุปจำนวน */}
      {hasCarton && (
        <div className="card border-l-4 border-primary-container">
          <span className="section-title">สรุปจำนวนรวม</span>
          <div className="grid grid-cols-3 gap-2 mt-2 text-center text-sm">
            <div>
              <div className="text-xl font-headline font-bold text-primary">{fullCartons}</div>
              <div className="text-[10px] text-outline">ลังเต็ม</div>
            </div>
            <div>
              <div className="text-xl font-headline font-bold text-tertiary-fixed-dim">{remainderPcs}</div>
              <div className="text-[10px] text-outline">ชิ้นเศษ</div>
            </div>
            <div>
              <div className="text-xl font-headline font-bold text-primary">{totalPcs.toLocaleString()}</div>
              <div className="text-[10px] text-outline">ชิ้นรวม</div>
            </div>
          </div>
        </div>
      )}

      <Link href={`/doc/${params.id}/pdf`} className="btn-secondary self-start">
        <Icon name="picture_as_pdf" /> ดูตัวอย่าง / Export PDF
      </Link>

      <SubmitPanel
        docId={params.id}
        canSubmit={hasAll}
        status={doc.status}
        canRecall={doc.status === "pending_sap" && doc.submitted_by === profile?.id}
      />
    </div>
  );
}
