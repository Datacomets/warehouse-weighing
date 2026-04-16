import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { TopAppBar } from "@/components/TopAppBar";
import { BottomNav } from "@/components/BottomNav";
import { Icon } from "@/components/Icon";
import { startOfDayTH } from "@/lib/dateUtils";
import { canAccessTeam } from "@/lib/permissions";
import { countDocsByUser, buildOperatorRows, teamTotals } from "@/lib/teamStats";

export default async function TeamPage() {
  const { profile } = await getCurrentUserAndProfile();
  if (!profile) redirect("/login");
  if (!canAccessTeam(profile.role)) redirect("/home");

  const supabase = createClient();

  const [{ data: operators }, { data: docs }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("role", "operator")
      .eq("active", true)
      .order("full_name", { ascending: true }),
    supabase
      .from("gr_documents")
      .select("id,status,created_by,closed_at")
      .in("status", ["in_progress", "pending_sap", "completed"]),
  ]);

  const byUser = countDocsByUser(docs || [], startOfDayTH());
  const rows = buildOperatorRows(operators || [], byUser);
  const { totalInProgress, totalPending, totalCompletedToday } = teamTotals(rows);

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
