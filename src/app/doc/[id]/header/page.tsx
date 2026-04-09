import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { HeaderForm } from "./HeaderForm";

export default async function HeaderPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { profile } = await getCurrentUserAndProfile();
  const { data: doc } = await supabase
    .from("gr_documents")
    .select("*")
    .eq("id", params.id)
    .single();

  return <HeaderForm doc={doc} userId={profile?.id} />;
}
