import { createClient } from "@/lib/supabase/server";
import { CountGrid } from "./CountGrid";
import { SectionHeader } from "@/components/Field";

export default async function CountPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: doc } = await supabase
    .from("gr_documents")
    .select("*")
    .eq("id", params.id)
    .single();
  const { data: entries } = await supabase
    .from("count_grid_entries")
    .select("*")
    .eq("document_id", params.id);

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader icon="local_shipping" title="ชั่ง Per Carton (ใบตรวจนับ)" accent />
      <div className="card text-xs grid grid-cols-2 gap-1">
        <div><b>LOT:</b> {doc.lot}</div>
        <div><b>Item:</b> {doc.item_code}</div>
        <div className="col-span-2"><b>Description:</b> {doc.description}</div>
        <div><b>ชิ้น/ลัง:</b> {doc.qty_per_carton ?? "-"}</div>
      </div>
      <CountGrid documentId={params.id} doc={doc} initial={(entries || []) as any} />
    </div>
  );
}
