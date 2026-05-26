import { notFound } from "next/navigation";
import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { CountGrid } from "./CountGrid";
import { SectionHeader } from "@/components/Field";
import { SkipSection } from "@/components/SkipSection";
import { canEditDocumentData } from "@/lib/workflow";

export default async function CountPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { profile } = await getCurrentUserAndProfile();
  const { data: doc } = await supabase
    .from("gr_documents")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!doc) notFound();
  const { data: entries } = await supabase
    .from("count_grid_entries")
    .select("*")
    .eq("document_id", params.id);

  const readOnly = !profile || !canEditDocumentData(profile.role, doc.status);
  const skipped = !!doc.skip_per_carton;

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader icon="local_shipping" title="ชั่ง Per Carton (ใบตรวจนับ)" accent />
      <div className="card text-xs grid grid-cols-2 gap-1">
        <div><b>LOT:</b> {doc.lot}</div>
        <div><b>Item:</b> {doc.item_code}</div>
        <div className="col-span-2"><b>Description:</b> {doc.description}</div>
        <div><b>ชิ้น/ลัง:</b> {doc.qty_per_carton ?? "-"}</div>
      </div>
      <SkipSection
        docId={doc.id}
        kind="per_carton"
        initialSkipped={skipped}
        initialReason={doc.skip_reason_per_carton ?? null}
        hasData={(entries?.length || 0) > 0}
        readOnly={readOnly}
      />
      {skipped ? (
        <p className="text-xs text-outline">
          เมื่อข้ามการชั่งต่อลัง ระบบจะข้ามการนับเศษให้อัตโนมัติในขั้นส่งงาน
        </p>
      ) : (
        <CountGrid
          documentId={params.id}
          doc={doc}
          initial={(entries || []) as any}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}
