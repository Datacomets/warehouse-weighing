import { createClient } from "@/lib/supabase/server";
import { SubmitPanel } from "./SubmitPanel";
import { SectionHeader } from "@/components/Field";
import { fmtDateTime, leadTimeText } from "@/lib/stats";
import Link from "next/link";
import { Icon } from "@/components/Icon";

export default async function SubmitPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: doc } = await supabase
    .from("gr_documents")
    .select("*")
    .eq("id", params.id)
    .single();

  // Check completeness — Per Pcs + Per Inner (weight_measurements) + Per Carton (count_grid_entries)
  const { data: items } = await supabase
    .from("weight_measurements")
    .select("kind")
    .eq("document_id", params.id);
  const { count: gridCount } = await supabase
    .from("count_grid_entries")
    .select("*", { count: "exact", head: true })
    .eq("document_id", params.id);

  const kinds = new Set((items || []).map((i: any) => i.kind));
  const hasPcs = kinds.has("per_pcs");
  const hasInner = kinds.has("per_inner");
  const hasCarton = (gridCount || 0) > 0;
  const hasAll = hasPcs && hasInner && hasCarton;

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
        </ul>
      </div>

      <Link href={`/doc/${params.id}/pdf`} className="btn-secondary self-start">
        <Icon name="picture_as_pdf" /> ดูตัวอย่าง / Export PDF
      </Link>

      <SubmitPanel docId={params.id} canSubmit={hasAll} status={doc.status} />
    </div>
  );
}
