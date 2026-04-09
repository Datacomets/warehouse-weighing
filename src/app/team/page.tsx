import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { TopAppBar } from "@/components/TopAppBar";
import { BottomNav } from "@/components/BottomNav";
import { Icon } from "@/components/Icon";
import { startOfDayTH } from "@/lib/dateUtils";

export default async function TeamPage() {
  const { profile } = await getCurrentUserAndProfile();
  if (!profile) redirect("/login");
  if (!["qc", "manager", "admin"].includes(profile.role)) redirect("/home");

  const supabase = createClient();

  // ดึง operator ทุกคน + เอกสารทั้งหมด (200 ล่าสุด) มา group ในหน่วยความจำ
  const [{ data: operators }, { data: docs }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("role", "operator")
      .eq("active", true)
      .order("full_name", { ascending: true }),
    supabase
      .from("gr_documents")
      .select("id,status,created_by,closed_at,started_at")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const startOfDay = startOfDayTH();

  type Counts = {
    inProgress: number;
    pending: number;
    completedToday: number;
    completedTotal: number;
  };
  const byUser = new Map<string, Counts>();
  (docs || []).forEach((d: any) => {
    if (!d.created_by) return;
    const c =
      byUser.get(d.created_by) ||
      ({ inProgress: 0, pending: 0, completedToday: 0, completedTotal: 0 } as Counts);
    if (d.status === "in_progress") c.inProgress++;
    else if (d.status === "pending_sap") c.pending++;
    else if (d.status === "completed") {
      c.completedTotal++;
      if (d.closed_at && new Date(d.closed_at) >= startOfDay) c.completedToday++;
    }
    byUser.set(d.created_by, c);
  });

  const rows = (operators || []).map((u: any) => ({
    user: u,
    counts:
      byUser.get(u.id) ||
      ({ inProgress: 0, pending: 0, completedToday: 0, completedTotal: 0 } as Counts),
  }));

  // เรียง: คนที่กำลังทำเยอะอยู่ก่อน แล้วคนที่ค้าง SAP เยอะ
  rows.sort((a, b) => {
    if (b.counts.inProgress !== a.counts.inProgress)
      return b.counts.inProgress - a.counts.inProgress;
    return b.counts.pending - a.counts.pending;
  });

  const totalInProgress = rows.reduce((s, r) => s + r.counts.inProgress, 0);
  const totalPending = rows.reduce((s, r) => s + r.counts.pending, 0);
  const totalCompletedToday = rows.reduce((s, r) => s + r.counts.completedToday, 0);

  return (
    <>
      <TopAppBar title="ทีมพนักงาน" subtitle={profile.full_name} />
      <main className="mt-16 pb-32 px-4 flex flex-col gap-4">
        <section className="grid grid-cols-3 gap-3">
          <Summary label="กำลังทำ" value={totalInProgress} icon="autorenew" />
          <Summary label="ค้าง SAP" value={totalPending} icon="pending_actions" />
          <Summary
            label="เสร็จวันนี้"
            value={totalCompletedToday}
            icon="check_circle"
          />
        </section>

        <div className="flex flex-col gap-3">
          {rows.length === 0 && (
            <div className="card text-center text-outline py-12">
              <Icon name="group_off" className="text-4xl mb-2" />
              <p className="text-sm">ยังไม่มีพนักงานในระบบ</p>
            </div>
          )}
          {rows.map(({ user, counts }) => (
            <Link
              key={user.id}
              href={`/team/${user.id}`}
              className="card flex items-center gap-3 hover:bg-surface-container-high"
            >
              <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold">
                {user.full_name?.[0] || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{user.full_name}</div>
                <div className="flex gap-3 mt-1 text-[11px]">
                  <Stat
                    icon="autorenew"
                    color="text-primary"
                    label="กำลังทำ"
                    value={counts.inProgress}
                  />
                  <Stat
                    icon="pending_actions"
                    color="text-tertiary-fixed-dim"
                    label="ค้าง SAP"
                    value={counts.pending}
                  />
                  <Stat
                    icon="check_circle"
                    color="text-secondary"
                    label="วันนี้"
                    value={counts.completedToday}
                  />
                </div>
              </div>
              <Icon name="chevron_right" className="text-outline" />
            </Link>
          ))}
        </div>
      </main>
      <BottomNav role={profile.role} />
    </>
  );
}

function Summary({
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

function Stat({
  icon,
  color,
  label,
  value,
}: {
  icon: string;
  color: string;
  label: string;
  value: number;
}) {
  return (
    <span className={`flex items-center gap-1 ${color}`}>
      <Icon name={icon} className="text-xs" />
      <span className="font-bold">{value}</span>
      <span className="text-outline">{label}</span>
    </span>
  );
}
