import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { TopAppBar } from "@/components/TopAppBar";
import { StatusBadge } from "@/components/StatusBadge";
import { Icon } from "@/components/Icon";
import { fmt, fmtDate, fmtDateTime, leadTimeText, stats } from "@/lib/stats";
import { SapEntryForm } from "./SapEntryForm";
import { UnlockButton } from "./UnlockButton";

export default async function AdminDocPage({ params }: { params: { id: string } }) {
  const { profile } = await getCurrentUserAndProfile();
  if (!profile) redirect("/login");
  if (!["admin_sap", "admin"].includes(profile.role)) redirect("/home");

  const supabase = createClient();
  const { data: doc } = await supabase
    .from("gr_documents")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!doc) notFound();

  const { data: items } = await supabase
    .from("weight_measurements")
    .select("*")
    .eq("document_id", params.id);
  const { data: gridEntries } = await supabase
    .from("count_grid_entries")
    .select("value")
    .eq("document_id", params.id);

  const perPcs = stats((items || []).filter((i: any) => i.kind === "per_pcs").map((i: any) => Number(i.value)));
  const perInner = stats((items || []).filter((i: any) => i.kind === "per_inner").map((i: any) => Number(i.value)));
  const perCarton = stats((gridEntries || []).map((g: any) => Number(g.value)));

  return (
    <>
      <TopAppBar title={doc.wh_number} subtitle="Admin SAP Entry" showBack rightSlot={<StatusBadge status={doc.status} />} />
      <main className="mt-16 pb-32 px-4 flex flex-col gap-5">
        <div className="card border-l-4 border-primary-container">
          <span className="section-title">ข้อมูลที่ต้องกรอกเข้า SAP</span>
          <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
            <Field label="PO Number" value={doc.po_number} />
            <Field label="Item Code" value={doc.item_code} />
            <Field label="Description" value={doc.description} className="col-span-2" />
            <Field label="LOT" value={doc.lot} />
            <Field label="Supplier" value={doc.supplier} />
            <Field label="Delivery Date" value={fmtDate(doc.delivery_date)} />
            <Field label="Notification ID" value={doc.sap_notification_id} />
            <Field label="Qty / Carton" value={doc.qty_per_carton} />
            <Field label="Actual Cartons" value={doc.actual_count} />
            <Field label="Gross Weight" value={doc.gross_weight ? `${doc.gross_weight} kg` : null} />
            <Field label="Net Weight" value={doc.net_weight ? `${doc.net_weight} kg` : null} />
          </div>
        </div>

        <div className="card">
          <span className="section-title">สถิติน้ำหนัก</span>
          <div className="grid grid-cols-3 gap-2 text-xs mt-2">
            <Stat label="Per Pcs" data={perPcs} />
            <Stat label="Per Inner" data={perInner} />
            <Stat label="Per Carton" data={perCarton} />
          </div>
        </div>

        <div className="card text-xs">
          <span className="section-title">Workflow</span>
          <p className="mt-2">
            <b>ส่งโดย:</b> {doc.submitted_by ? "พนักงาน" : "-"} ·{" "}
            <b>เวลา:</b> {fmtDateTime(doc.submitted_at)}
          </p>
          <p>
            <b>Lead Time:</b>{" "}
            {leadTimeText(doc.started_at, doc.submitted_at || doc.ended_at)}
          </p>
        </div>

        <div className="flex gap-2">
          <Link href={`/doc/${doc.id}/pdf`} className="btn-secondary flex-1">
            <Icon name="picture_as_pdf" /> Export PDF
          </Link>
          {doc.status === "pending_sap" && <UnlockButton docId={doc.id} />}
        </div>

        {doc.status === "pending_sap" && <SapEntryForm doc={doc} userId={profile.id} />}
        {doc.status === "completed" && (
          <div className="card border-l-4 border-success">
            <span className="section-title">SAP Linked</span>
            <p className="text-sm mt-1">
              <b>CFSD:</b> {doc.sap_inbound_id} <br />
              <b>ปิดงานเมื่อ:</b> {fmtDateTime(doc.closed_at)}
            </p>
          </div>
        )}
      </main>
    </>
  );
}

function Field({ label, value, className }: { label: string; value: any; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[10px] text-outline uppercase">{label}</div>
      <div className="font-semibold text-on-surface">{value || "-"}</div>
    </div>
  );
}

function Stat({ label, data }: { label: string; data: ReturnType<typeof stats> }) {
  return (
    <div className="bg-surface-container-low rounded-lg p-2">
      <div className="text-[10px] text-outline uppercase">{label}</div>
      <div className="text-xs">AVG: <b>{fmt(data.avg)}</b></div>
      <div className="text-xs">MIN: <b>{fmt(data.min)}</b></div>
      <div className="text-xs">MAX: <b>{fmt(data.max)}</b></div>
      <div className="text-[10px] text-outline">n={data.count}</div>
    </div>
  );
}
