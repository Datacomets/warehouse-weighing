import { redirect } from "next/navigation";
import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { TopAppBar } from "@/components/TopAppBar";
import { isDocCanceler } from "@/lib/cancelDocs";
import { CancelManager, type CancelDoc } from "./CancelManager";

const COLS =
  "id,wh_number,status,item_code,description,po_number,lot,created_at,created_by,cancelled_at,cancelled_by,cancel_reason,cancel_dup_wh,cancel_note";

export default async function CancelPage({ searchParams }: { searchParams: { ids?: string; tab?: string } }) {
  const { profile } = await getCurrentUserAndProfile();
  if (!profile) redirect("/login");

  const supabase = createClient();
  if (!(await isDocCanceler(supabase, profile.id))) redirect("/home");

  const [{ data: active }, { data: cancelled }] = await Promise.all([
    supabase
      .from("gr_documents")
      .select(COLS)
      .is("cancelled_at", null)
      .in("status", ["in_progress", "pending_sap"])
      .order("created_at", { ascending: false }),
    supabase
      .from("gr_documents")
      .select(COLS)
      .not("cancelled_at", "is", null)
      .order("cancelled_at", { ascending: false })
      .limit(200),
  ]);

  const userIds = new Set<string>();
  for (const d of [...(active || []), ...(cancelled || [])]) {
    if (d.created_by) userIds.add(d.created_by);
    if (d.cancelled_by) userIds.add(d.cancelled_by);
  }
  const { data: people } = userIds.size
    ? await supabase.from("profiles").select("id,full_name").in("id", Array.from(userIds))
    : { data: [] as { id: string; full_name: string }[] };
  const names: Record<string, string> = {};
  for (const p of people || []) names[p.id] = p.full_name;

  const preselect = (searchParams.ids || "").split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <>
      <TopAppBar title="ยกเลิกใบงาน" subtitle="เลือกใบงาน → เหตุผล → ยืนยัน" showBack />
      <main className="mt-16 pb-40 px-4">
        <CancelManager
          active={(active || []) as CancelDoc[]}
          cancelled={(cancelled || []) as CancelDoc[]}
          names={names}
          preselect={preselect}
          initialTab={searchParams.tab === "cancelled" ? "cancelled" : "active"}
        />
      </main>
    </>
  );
}
