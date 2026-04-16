import { leadTimeMinutes } from "./stats";

/** Default KPI threshold in minutes for dashboard lead-time warnings. */
export const DEFAULT_KPI_LEAD_TIME_MINUTES = 120;

/** Minimal doc shape used by dashboard aggregations. */
export interface DashboardDoc {
  status?: string;
  created_at?: string | null;
  started_at?: string | null;
  closed_at?: string | null;
  gross_weight?: number | string | null;
  actual_count?: number | string | null;
  supplier?: string | null;
}

/** Sum of (gross_weight × actual_count). Null / NaN contribute 0. */
export function totalGrossWeight(docs: DashboardDoc[]): number {
  return docs.reduce((sum, d) => {
    const g = Number(d.gross_weight) || 0;
    const n = Number(d.actual_count) || 0;
    return sum + g * n;
  }, 0);
}

/** Docs whose `created_at` ≥ start-of-today (caller supplies the Date). */
export function todaysDocs(docs: DashboardDoc[], startOfDay: Date): DashboardDoc[] {
  return docs.filter((d) => d.created_at != null && new Date(d.created_at) >= startOfDay);
}

export interface LeadTimeSummary {
  /** Minutes, rounded. 0 when there are no data points. */
  avgMinutes: number;
  /** Number of completed docs exceeding the KPI threshold. */
  countOverKpi: number;
  /** All individual lead times, in minutes. */
  leadTimes: number[];
}

/**
 * Lead-time summary from all docs that have both started_at and closed_at.
 * Matches the dashboard page's current behavior (which does NOT filter by
 * status — any doc with both timestamps counts).
 */
export function leadTimeSummary(
  docs: DashboardDoc[],
  kpiMinutes: number = DEFAULT_KPI_LEAD_TIME_MINUTES
): LeadTimeSummary {
  const completed = docs.filter((d) => d.status === "completed");
  const leadTimes = completed
    .filter((d) => d.started_at && d.closed_at)
    .map((d) => leadTimeMinutes(d.started_at as string, d.closed_at as string));

  const avgMinutes = leadTimes.length
    ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length)
    : 0;
  const countOverKpi = leadTimes.filter((m) => m > kpiMinutes).length;

  return { avgMinutes, countOverKpi, leadTimes };
}

/** Sum of (gross × count) grouped by supplier name. Null supplier → "ไม่ระบุ". */
export function groupGrossBySupplier(docs: DashboardDoc[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of docs) {
    const key = d.supplier || "ไม่ระบุ";
    const g = Number(d.gross_weight) || 0;
    const n = Number(d.actual_count) || 0;
    out[key] = (out[key] || 0) + g * n;
  }
  return out;
}

/* ---------- Chart transforms (used by DashboardCharts client component) ---------- */

export interface SupplierChartPoint {
  name: string;
  weight: number;
}

/**
 * Converts the supplier map into a sorted top-N list with truncated names
 * (chart labels look cleaner when long supplier names are elided).
 */
export function supplierChartData(
  bySupplier: Record<string, number>,
  { topN = 8, maxNameLength = 14 }: { topN?: number; maxNameLength?: number } = {}
): SupplierChartPoint[] {
  return Object.entries(bySupplier)
    .map(([name, weight]) => ({
      name: name.length > maxNameLength ? name.slice(0, maxNameLength) + "…" : name,
      weight,
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, topN);
}

export interface DailyLeadTimePoint {
  /** "MM-DD" suffix — chart x-axis label. */
  day: string;
  /** Minutes, rounded. */
  avg: number;
}

/**
 * Groups completed docs by `created_at` date (YYYY-MM-DD), averages the
 * lead time per day, and returns the last N days sorted ascending.
 */
export function dailyLeadTimeAverages(
  docs: DashboardDoc[],
  { windowDays = 14 }: { windowDays?: number } = {}
): DailyLeadTimePoint[] {
  const byDay: Record<string, number[]> = {};
  for (const d of docs) {
    if (d.status === "completed" && d.closed_at && d.started_at && d.created_at) {
      const day = d.created_at.slice(0, 10);
      const lt = leadTimeMinutes(d.started_at, d.closed_at);
      (byDay[day] = byDay[day] || []).push(lt);
    }
  }
  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-windowDays)
    .map(([day, arr]) => ({
      day: day.slice(5),
      avg: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
    }));
}
