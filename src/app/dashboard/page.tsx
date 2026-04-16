import { redirect } from "next/navigation";
import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { TopAppBar } from "@/components/TopAppBar";
import { BottomNav } from "@/components/BottomNav";
import { DashboardCharts } from "./DashboardCharts";
import { Icon } from "@/components/Icon";
import { logger } from "@/lib/logger";
import {
  DEFAULT_KPI_LEAD_TIME_MINUTES,
  totalGrossWeight,
  todaysDocs,
  leadTimeSummary,
  groupGrossBySupplier,
} from "@/lib/dashboardStats";

const KPI_LEAD_TIME_MINUTES = DEFAULT_KPI_LEAD_TIME_MINUTES;

export default async function DashboardPage() {
  const { profile } = await getCurrentUserAndProfile();
  if (!profile) redirect("/login");

  const supabase = createClient();
  const { data: docs, error: docsErr } = await supabase
    .from("gr_documents")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (docsErr) logger.error("Dashboard query error", { error: docsErr.message });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const allDocs = docs || [];
  const todayDocs = todaysDocs(allDocs, today);
  const totalGross = totalGrossWeight(allDocs);
  const { avgMinutes: avgLead, countOverKpi: overKpi } = leadTimeSummary(
    allDocs,
    KPI_LEAD_TIME_MINUTES
  );
  const bySupplier = groupGrossBySupplier(allDocs);

  return (
    <>
      <TopAppBar title="Dashboard" subtitle={profile.full_name} />
      <main className="mt-16 pb-32 px-4 flex flex-col gap-4">
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi icon="receipt_long" label="วันนี้" value={todayDocs.length.toString()} hint="ใบรับ" />
          <Kpi icon="scale" label="น้ำหนักรวม" value={totalGross.toFixed(0) + " kg"} hint="ทั้งหมด" />
          <Kpi
            icon="schedule"
            label="Avg Lead Time"
            value={avgLead + " นาที"}
            hint={`KPI ${KPI_LEAD_TIME_MINUTES} นาที`}
            warn={avgLead > KPI_LEAD_TIME_MINUTES}
          />
          <Kpi icon="warning" label="เกิน KPI" value={overKpi.toString()} hint="ใบ" warn={overKpi > 0} />
        </section>

        <DashboardCharts
          bySupplier={bySupplier}
          docs={(docs || []).map((d: any) => ({
            id: d.id,
            wh_number: d.wh_number,
            status: d.status,
            created_at: d.created_at,
            closed_at: d.closed_at,
            started_at: d.started_at,
            gross_weight: Number(d.gross_weight) || 0,
            actual_count: Number(d.actual_count) || 0,
          }))}
          kpi={KPI_LEAD_TIME_MINUTES}
        />
      </main>
      <BottomNav role={profile.role} />
    </>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
  warn,
}: {
  icon: string;
  label: string;
  value: string;
  hint: string;
  warn?: boolean;
}) {
  return (
    <div className={`card border-l-4 ${warn ? "border-error" : "border-primary-container"}`}>
      <div className="flex items-center gap-2">
        <Icon name={icon} className={warn ? "text-error" : "text-primary"} />
        <span className="section-title">{label}</span>
      </div>
      <div className="text-2xl font-headline font-bold text-primary mt-1">{value}</div>
      <div className="text-[10px] text-outline">{hint}</div>
    </div>
  );
}
