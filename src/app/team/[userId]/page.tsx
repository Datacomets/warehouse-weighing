import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { clsx } from "clsx";
import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { TopAppBar } from "@/components/TopAppBar";
import { BottomNav } from "@/components/BottomNav";
import { DocumentCard } from "@/components/DocumentCard";
import { Icon } from "@/components/Icon";
import { startOfDayTH } from "@/lib/dateUtils";

type Tab = "in_progress" | "pending" | "completed" | "all";

export default async function TeamUserPage({
  params,
  searchParams,
}: {
  params: { userId: string };
  searchParams: { tab?: string };
}) {
  const { profile } = await getCurrentUserAndProfile();
  if (!profile) redirect("/login");
  if (!["qc", "manager", "admin"].includes(profile.role)) redirect("/home");

  const tab: Tab =
    searchParams.tab === "pending"
      ? "pending"
      : searchParams.tab === "completed"
      ? "completed"
      : searchParams.tab === "all"
      ? "all"
      : "in_progress";

  const supabase = createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", params.userId)
    .single();
  if (!target) notFound();

  let query = supabase
    .from("gr_documents")
    .select("*")
    .eq("created_by", params.userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (tab === "in_progress") query = query.eq("status", "in_progress");
  else if (tab === "pending") query = query.eq("status", "pending_sap");
  else if (tab === "completed") query = query.eq("status", "completed");

  const { data: docs } = await query;

  // นับสรุป (ดึงแยกเพื่อให้ตัวเลขทุกแท็บถูกต้อง)
  const { data: allForCount } = await supabase
    .from("gr_documents")
    .select("status,closed_at")
    .eq("created_by", params.userId);

  const startOfDay = startOfDayTH();

  let cInProgress = 0,
    cPending = 0,
    cCompleted = 0,
    cToday = 0;
  (allForCount || []).forEach((d: any) => {
    if (d.status === "in_progress") cInProgress++;
    else if (d.status === "pending_sap") cPending++;
    else if (d.status === "completed") {
      cCompleted++;
      if (d.closed_at && new Date(d.closed_at) >= startOfDay) cToday++;
    }
  });

  return (
    <>
      <TopAppBar
        title={target.full_name}
        subtitle={`พนักงาน · เสร็จวันนี้ ${cToday} งาน`}
      />
      <main className="mt-16 pb-32 px-4 flex flex-col gap-4">
        <Link
          href="/team"
          className="text-xs text-primary flex items-center gap-1"
        >
          <Icon name="arrow_back" className="text-sm" />
          กลับไปทีมพนักงาน
        </Link>

        <section className="grid grid-cols-2 gap-3">
          <SummaryCard
            label="กำลังทำ"
            value={cInProgress}
            icon="autorenew"
          />
          <SummaryCard
            label="ค้าง SAP"
            value={cPending}
            icon="pending_actions"
          />
          <SummaryCard
            label="เสร็จวันนี้"
            value={cToday}
            icon="check_circle"
          />
          <SummaryCard
            label="เสร็จทั้งหมด"
            value={cCompleted}
            icon="verified"
          />
        </section>

        <nav className="flex gap-2 overflow-x-auto -mx-4 px-4 no-scrollbar">
          <TabLink tab="in_progress" current={tab} userId={params.userId} label={`กำลังทำ (${cInProgress})`} />
          <TabLink tab="pending" current={tab} userId={params.userId} label={`ค้าง SAP (${cPending})`} />
          <TabLink tab="completed" current={tab} userId={params.userId} label={`เสร็จแล้ว (${cCompleted})`} />
          <TabLink tab="all" current={tab} userId={params.userId} label="ทั้งหมด" />
        </nav>

        <div className="flex flex-col gap-3">
          {(docs || []).length === 0 && (
            <div className="card text-center text-outline py-12">
              <Icon name="inbox" className="text-4xl mb-2" />
              <p className="text-sm">ไม่มีงานในหมวดนี้</p>
            </div>
          )}
          {(docs || []).map((d: any) => (
            <DocumentCard
              key={d.id}
              doc={d}
              href={`/doc/${d.id}/header`}
            />
          ))}
        </div>
      </main>
      <BottomNav role={profile.role} />
    </>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="card flex flex-col gap-1 border-l-4 border-primary-container">
      <div className="flex items-center gap-1 text-outline">
        <Icon name={icon} className="text-sm" />
        <span className="text-[10px] font-bold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="text-2xl font-headline font-bold text-primary">{value}</div>
    </div>
  );
}

function TabLink({
  tab,
  current,
  userId,
  label,
}: {
  tab: Tab;
  current: Tab;
  userId: string;
  label: string;
}) {
  const active = tab === current;
  return (
    <Link
      href={`/team/${userId}?tab=${tab}`}
      className={clsx(
        "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors",
        active
          ? "bg-primary text-on-primary shadow"
          : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
      )}
    >
      {label}
    </Link>
  );
}
