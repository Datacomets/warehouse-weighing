import { createClient } from "@/lib/supabase/server";
import { PdfClient } from "./PdfClient";

export default async function PdfPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: doc } = await supabase
    .from("gr_documents")
    .select("*")
    .eq("id", params.id)
    .single();
  const { data: items } = await supabase
    .from("weight_measurements")
    .select("*")
    .eq("document_id", params.id);
  const { data: grid } = await supabase
    .from("count_grid_entries")
    .select("*")
    .eq("document_id", params.id);
  const { data: issues } = await supabase
    .from("issue_reports")
    .select("*")
    .eq("document_id", params.id)
    .order("created_at", { ascending: false });

  // Resolve preparer / checker names for the signature block.
  const personIds = [doc?.created_by, doc?.submitted_by, doc?.closed_by].filter(Boolean);
  let nameById: Record<string, string> = {};
  if (personIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", personIds as string[]);
    nameById = Object.fromEntries((profs || []).map((p: any) => [p.id, p.full_name]));
  }
  const preparedBy = doc?.created_by ? nameById[doc.created_by] || "" : "";
  const checkedBy = doc?.closed_by
    ? nameById[doc.closed_by] || ""
    : doc?.submitted_by
    ? nameById[doc.submitted_by] || ""
    : "";

  return (
    <PdfClient
      doc={doc}
      items={items || []}
      grid={grid || []}
      issues={issues || []}
      preparedBy={preparedBy}
      checkedBy={checkedBy}
    />
  );
}
