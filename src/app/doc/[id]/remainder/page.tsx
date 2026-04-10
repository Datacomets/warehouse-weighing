import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RemainderForm } from "./RemainderForm";
import { SectionHeader } from "@/components/Field";

export default async function RemainderPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: doc } = await supabase
    .from("gr_documents")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!doc) notFound();

  const { count: fullCartons } = await supabase
    .from("count_grid_entries")
    .select("*", { count: "exact", head: true })
    .eq("document_id", params.id);

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader icon="exposure" title="นับเศษ (Remainder)" accent />
      <RemainderForm
        doc={doc}
        fullCartons={fullCartons || 0}
      />
    </div>
  );
}
