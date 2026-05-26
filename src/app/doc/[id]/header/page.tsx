import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { HeaderForm } from "./HeaderForm";
import { canEditDocumentData } from "@/lib/workflow";

export default async function HeaderPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { profile } = await getCurrentUserAndProfile();
  const { data: doc } = await supabase
    .from("gr_documents")
    .select("*")
    .eq("id", params.id)
    .single();

  const readOnly =
    !profile || !doc
      ? true
      : !canEditDocumentData(profile.role, doc.status);

  return <HeaderForm doc={doc} userId={profile?.id} readOnly={readOnly} />;
}
