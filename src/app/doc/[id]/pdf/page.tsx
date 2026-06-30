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

  return <PdfClient doc={doc} items={items || []} grid={grid || []} issues={issues || []} />;
}
