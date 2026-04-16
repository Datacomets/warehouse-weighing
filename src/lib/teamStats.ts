export interface OperatorCounts {
  inProgress: number;
  pending: number;
  completedToday: number;
  completedTotal: number;
}

export interface TeamDoc {
  status?: string | null;
  created_by?: string | null;
  closed_at?: string | null;
}

export interface Operator {
  id: string;
  full_name: string;
}

export interface OperatorRow {
  user: Operator;
  counts: OperatorCounts;
}

export function emptyCounts(): OperatorCounts {
  return { inProgress: 0, pending: 0, completedToday: 0, completedTotal: 0 };
}

/**
 * Tallies doc counts per `created_by` user, splitting by status.
 * `completedToday` requires `closed_at` ≥ `startOfDay`.
 */
export function countDocsByUser(
  docs: TeamDoc[],
  startOfDay: Date
): Map<string, OperatorCounts> {
  const out = new Map<string, OperatorCounts>();
  for (const d of docs) {
    if (!d.created_by) continue;
    const c = out.get(d.created_by) ?? emptyCounts();
    if (d.status === "in_progress") c.inProgress++;
    else if (d.status === "pending_sap") c.pending++;
    else if (d.status === "completed") {
      c.completedTotal++;
      if (d.closed_at && new Date(d.closed_at) >= startOfDay) c.completedToday++;
    }
    out.set(d.created_by, c);
  }
  return out;
}

/**
 * Builds rows of (operator, counts) and sorts them by inProgress desc,
 * then pending desc — busiest operators first.
 */
export function buildOperatorRows(
  operators: Operator[],
  countsByUser: Map<string, OperatorCounts>
): OperatorRow[] {
  const rows = operators.map((u) => ({
    user: u,
    counts: countsByUser.get(u.id) ?? emptyCounts(),
  }));
  rows.sort((a, b) => {
    if (b.counts.inProgress !== a.counts.inProgress) {
      return b.counts.inProgress - a.counts.inProgress;
    }
    return b.counts.pending - a.counts.pending;
  });
  return rows;
}

export interface TeamTotals {
  totalInProgress: number;
  totalPending: number;
  totalCompletedToday: number;
}

export function teamTotals(rows: OperatorRow[]): TeamTotals {
  return rows.reduce<TeamTotals>(
    (acc, r) => ({
      totalInProgress: acc.totalInProgress + r.counts.inProgress,
      totalPending: acc.totalPending + r.counts.pending,
      totalCompletedToday: acc.totalCompletedToday + r.counts.completedToday,
    }),
    { totalInProgress: 0, totalPending: 0, totalCompletedToday: 0 }
  );
}
