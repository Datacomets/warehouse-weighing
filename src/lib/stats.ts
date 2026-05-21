export function stats(values: number[]) {
  const filtered = values.filter((v) => Number.isFinite(v));
  if (filtered.length === 0) return { avg: 0, min: 0, max: 0, count: 0 };
  const sum = filtered.reduce((a, b) => a + b, 0);
  return {
    avg: sum / filtered.length,
    min: Math.min(...filtered),
    max: Math.max(...filtered),
    count: filtered.length,
  };
}

export function fmt(n: number, digits = 3) {
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Date-only date strings (YYYY-MM-DD) from Postgres `date` columns parse as
 * UTC midnight. We force the Thai timezone so they render as the same
 * calendar day regardless of where the code runs (browser, Vercel UTC fn).
 */
export function fmtDate(s: string | null | undefined) {
  if (!s) return "-";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("th-TH-u-ca-gregory", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

/**
 * Timestamps from Postgres `timestamptz` are stored in UTC. We render them
 * in Thai timezone with a 24-hour clock so e.g. 14:45 stays as 14:45
 * (not "02:45 PM" without a marker).
 */
export function fmtDateTime(s: string | null | undefined) {
  if (!s) return "-";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("th-TH-u-ca-gregory", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

export function leadTimeMinutes(start: string, end: string) {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}

export function leadTimeText(start: string | null, end: string | null) {
  if (!start || !end) return "-";
  const m = leadTimeMinutes(start, end);
  if (m < 60) return `${m} นาที`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h} ชม. ${mm} นาที`;
}
