import { notFound } from "next/navigation";
import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { WeightEntry } from "@/components/WeightEntry";
import { PhotoUploader } from "@/components/PhotoUploader";
import { SectionHeader } from "@/components/Field";
import { SkipSection } from "@/components/SkipSection";
import { StepButtons } from "@/components/StepButtons";
import { canEditDocumentData } from "@/lib/workflow";

export default async function PerInnerPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { profile } = await getCurrentUserAndProfile();
  const { data: doc } = await supabase
    .from("gr_documents")
    .select("id,status,weight_unit,skip_per_inner,skip_reason_per_inner")
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

  const readOnly = !profile || !canEditDocumentData(profile.role, doc.status);
  const skipped = !!doc.skip_per_inner;

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader icon="inventory" title="ขั้นตอนที่ 3 — ชั่ง Per Inner / Tray / Bag" accent />
      <SkipSection
        docId={doc.id}
        kind="per_inner"
        initialSkipped={skipped}
        initialReason={doc.skip_reason_per_inner ?? null}
        hasData={(items?.length || 0) > 0}
        readOnly={readOnly}
      />
      {!skipped && (
        <>
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
        </>
      )}

      {!readOnly && (
        <StepButtons
          prev={`/doc/${params.id}/per-pcs`}
          prevLabel="ชั่งต่อชิ้น"
          next={`/doc/${params.id}/count`}
          nextLabel="ชั่งต่อลัง"
        />
      )}
    </div>
  );
}
