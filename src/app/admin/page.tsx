import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { TopAppBar } from "@/components/TopAppBar";
import { BottomNav } from "@/components/BottomNav";
import { DocumentCard } from "@/components/DocumentCard";
import { Icon } from "@/components/Icon";
import { clsx } from "clsx";

type Tab = "today" | "pending" | "all";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const { profile } = await getCurrentUserAndProfile();
  if (!profile) redirect("/login");
  if (!["admin_sap", "admin", "qc"].includes(profile.role)) redirect("/home");

  const tab: Tab =
    searchParams.tab === "pending"
      ? "pending"
      : searchParams.tab === "all"
      ? "all"
      : "today";

  const supabase = createClient();

  // ขอบเขตวันนี้ (เวลาท้องถิ่นเซิร์ฟเวอร์)
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const startISO = startOfDay.toISOString();
  const endISO = endOfDay.toISOString();

  // นับสรุปทุกแท็บ (สำหรับแสดงที่ chip)
  const [
    { data: todayInProgress },
    { data: todayCompleted },
    { data: pendingAll },
    { data: allDocs },
  ] = await Promise.all([
    supabase
      .from("gr_documents")
      .select("*")
      .eq("status", "in_progress")
      .gte("created_at", startISO)
      .lt("created_at", endISO)
      .order("created_at", { ascending: false }),
    supabase
      .from("gr_documents")
      .select("*")
      .eq("status", "completed")
      .gte("closed_at", startISO)
      .lt("closed_at", endISO)
      .order("closed_at", { ascending: false }),
    supabase
      .from("gr_documents")
      .select("*")
      .eq("status", "pending_sap")
      .order("submitted_at", { ascending: false }),
    tab === "all"
      ? supabase
          .from("gr_documents")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const countToday =
    (todayInProgress?.length || 0) + (todayCompleted?.length || 0);
  const countPending = pendingAll?.length || 0;
  const countAll = allDocs?.length || 0;

  return (
    <>
      <TopAppBar
        title="Admin SAP — งานคิว"
        subtitle={profile.full_name}
        rightSlot={
          <form action="/api/logout" method="post">
            <button className="p-2 rounded-full hover:bg-surface-container-high">
              <Icon name="logout" className="text-primary" />
            </button>
          </form>
        }
      />
      <main className="mt-16 pb-32 px-4 flex flex-col gap-4">
        {/* สรุปตัวเลข */}
        <section className="grid grid-cols-3 gap-3">
          <SummaryCard
            label="กำลังดำเนินการ"
            hint="วันนี้"
            value={todayInProgress?.length || 0}
            icon="autorenew"
          />
          <SummaryCard
            label="เสร็จสิ้น"
            hint="วันนี้"
            value={todayCompleted?.length || 0}
            icon="check_circle"
          />
          <SummaryCard
            label="ค้างอยู่"
            hint="รอ SAP"
            value={countPending}
            icon="pending_actions"
          />
        </section>

        {/* แท็บ */}
        <nav className="flex gap-2 overflow-x-auto -mx-4 px-4 no-scrollbar">
          <TabLink tab="today" current={tab} label={`วันนี้ (${countToday})`} />
          <TabLink
            tab="pending"
            current={tab}
            label={`ค้างอยู่ (${countPending})`}
          />
          <TabLink tab="all" current={tab} label="ทั้งหมด" />
        </nav>

        <Link
          href="/admin/items"
          className="card flex items-center gap-3 hover:bg-surface-container-high"
        >
          <Icon name="inventory_2" className="text-primary text-2xl" />
          <div className="flex-1">
            <div className="text-sm font-bold">Item Master</div>
            <div className="text-[11px] text-outline">
              นำเข้า / จัดการ Material จาก SAP
            </div>
          </div>
          <Icon name="chevron_right" className="text-outline" />
        </Link>

        {/* รายการตามแท็บ */}
        {tab === "today" && (
          <>
            <Section
              title="กำลังดำเนินการ (วันนี้)"
              icon="autorenew"
              docs={todayInProgress || []}
              emptyText="ไม่มีงานที่กำลังดำเนินการในวันนี้"
            />
            <Section
              title="เสร็จสิ้น (วันนี้)"
              icon="check_circle"
              docs={todayCompleted || []}
              emptyText="ยังไม่มีงานที่เสร็จสิ้นวันนี้"
            />
          </>
        )}

        {tab === "pending" && (
          <Section
            title="รอนำเข้า SAP (ค้างอยู่ทั้งหมด)"
            icon="pending_actions"
            docs={pendingAll || []}
            emptyText="ไม่มีงานค้างในคิว"
          />
        )}

        {tab === "all" && (
          <Section
            title="งานทั้งหมด (ทุกวัน)"
            icon="list_alt"
            docs={allDocs || []}
            emptyText="ยังไม่มีเอกสารในระบบ"
            countOverride={countAll}
          />
        )}
      </main>
      <BottomNav role={profile.role} />
    </>
  );
}

function SummaryCard({
  label,
  hint,
  value,
  icon,
}: {
  label: string;
  hint: string;
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
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-headline font-bold text-primary">
          {value}
        </span>
        <span className="text-[10px] text-outline">{hint}</span>
      </div>
    </div>
  );
}

function TabLink({
  tab,
  current,
  label,
}: {
  tab: Tab;
  current: Tab;
  label: string;
}) {
  const active = tab === current;
  return (
    <Link
      href={`/admin?tab=${tab}`}
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

function Section({
  title,
  icon,
  docs,
  emptyText,
  countOverride,
}: {
  title: string;
  icon: string;
  docs: any[];
  emptyText: string;
  countOverride?: number;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <Icon name={icon} className="text-primary text-base" />
        <h2 className="text-sm font-bold text-on-surface">{title}</h2>
        <span className="ml-auto text-[11px] text-outline">
          {countOverride ?? docs.length} รายการ
        </span>
      </div>
      {docs.length === 0 ? (
        <div className="card text-center text-outline py-8">
          <Icon name="inbox" className="text-3xl mb-1" />
          <p className="text-xs">{emptyText}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {docs.map((d: any) => (
            <Link key={d.id} href={`/admin/${d.id}`}>
              <DocumentCard doc={d} />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
