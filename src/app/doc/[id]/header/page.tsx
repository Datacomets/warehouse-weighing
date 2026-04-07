import { createClient } from "@/lib/supabase/server";
import { HeaderForm } from "./HeaderForm";

export default async function HeaderPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: doc } = await supabase
    .from("gr_documents")
    .select("*")
    .eq("id", params.id)
    .single();

  return <HeaderForm doc={doc} />;
}
