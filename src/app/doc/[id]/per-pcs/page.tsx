import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { WeightEntry } from "@/components/WeightEntry";
import { PhotoUploader } from "@/components/PhotoUploader";
import { SectionHeader } from "@/components/Field";
import { Icon } from "@/components/Icon";

export default async function PerPcsPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: doc } = await supabase
    .from("gr_documents")
    .select("id,status,weight_unit")
    .eq("id", params.id)
    .single();
  const { data: items } = await supabase
    .from("weight_measurements")
    .select("*")
    .eq("document_id", params.id)
    .eq("kind", "per_pcs")
    .order("seq");
  const { data: photos } = await supabase
    .from("weight_photos")
    .select("id,url")
    .eq("document_id", params.id)
    .eq("kind", "per_pcs");

  const readOnly = doc?.status !== "in_progress";

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader icon="balance" title="ขั้นตอนที่ 2 — ชั่ง Per Pcs" accent />
      <WeightEntry
        documentId={params.id}
        docId={doc?.id}
        kind="per_pcs"
        initial={(items || []) as any}
        readOnly={readOnly}
        initialUnit={doc?.weight_unit || "kg"}
      />
      <PhotoUploader documentId={params.id} kind="per_pcs" initial={(photos || []) as any} readOnly={readOnly} />

      {!readOnly && (
        <div className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-background via-background to-transparent px-4 py-4 z-30">
          <Link href={`/doc/${params.id}/per-inner`} className="btn-primary w-full">
            ถัดไป: ชั่ง Per Inner/Tray/Bag <Icon name="arrow_forward" />
          </Link>
        </div>
      )}
    </div>
  );
}
