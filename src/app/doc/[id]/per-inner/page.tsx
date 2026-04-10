import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WeightEntry } from "@/components/WeightEntry";
import { PhotoUploader } from "@/components/PhotoUploader";
import { SectionHeader } from "@/components/Field";
import { Icon } from "@/components/Icon";

export default async function PerInnerPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: doc } = await supabase
    .from("gr_documents")
    .select("id,status,weight_unit")
    .eq("id", params.id)
    .single();
  if (!doc) notFound();
  const { data: items } = await supabase
    .from("weight_measurements")
    .select("*")
    .eq("document_id", params.id)
    .eq("kind", "per_inner")
    .order("seq");
  const { data: photos } = await supabase
    .from("weight_photos")
    .select("id,url")
    .eq("document_id", params.id)
    .eq("kind", "per_inner");

  const readOnly = doc?.status !== "in_progress";

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader icon="inventory" title="ขั้นตอนที่ 3 — ชั่ง Per Inner / Tray / Bag" accent />
      <WeightEntry
        documentId={params.id}
        docId={doc.id}
        kind="per_inner"
        initial={(items || []) as any}
        readOnly={readOnly}
        showQtyPerInner
        initialUnit={doc.weight_unit || "kg"}
      />
      <PhotoUploader documentId={params.id} kind="per_inner" initial={(photos || []) as any} readOnly={readOnly} />

      {!readOnly && (
        <div className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-background via-background to-transparent px-4 py-4 z-30">
          <Link href={`/doc/${params.id}/count`} className="btn-primary w-full">
            ถัดไป: ชั่ง Per Carton <Icon name="arrow_forward" />
          </Link>
        </div>
      )}
    </div>
  );
}
