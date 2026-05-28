import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { IssuesPanel } from "./IssuesPanel";
import { SectionHeader } from "@/components/Field";
import { canEditDocumentData } from "@/lib/workflow";

export default async function IssuesPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { profile } = await getCurrentUserAndProfile();
  const { data: doc } = await supabase
    .from("gr_documents")
    .select("id,status")
    .eq("id", params.id)
    .single();
  const { data: issues } = await supabase
    .from("issue_reports")
    .select("*")
    .eq("document_id", params.id)
    .order("created_at", { ascending: false });

  const readOnly =
    !profile || !doc
      ? true
      : !canEditDocumentData(profile.role, doc.status);

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader icon="report" title="บันทึกปัญหา" accent />
      <IssuesPanel
        documentId={params.id}
        userId={profile?.id || ""}
        readOnly={readOnly}
        initial={(issues || []) as any}
        docStatus={doc?.status ?? "in_progress"}
      />
    </div>
  );
}
