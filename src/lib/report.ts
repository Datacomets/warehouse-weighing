/**
 * Report builder — filters, columns, presets and data fetch (view `report_docs`, migration 0013).
 * Shared by /report (preview), /api/report (Excel/CSV) and /report/print (PDF via browser print).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { leadTimeMinutes, leadTimeText } from "@/lib/stats";

export type Basis = "created_at" | "submitted_at" | "closed_at" | "delivery_date";
export const BASIS_LABEL: Record<Basis, string> = {
  created_at: "วันที่สร้างใบงาน",
  submitted_at: "วันที่ส่งงาน",
  closed_at: "วันที่ปิดงาน SAP",
  delivery_date: "Delivery Date",
};

export const STATUS_OPTS = [
  { v: "in_progress", label: "กำลังดำเนินการ" },
  { v: "pending_sap", label: "รอนำเข้า SAP" },
  { v: "completed", label: "เสร็จสมบูรณ์" },
  { v: "cancelled", label: "ยกเลิก" },
] as const;
export const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUS_OPTS.map((s) => [s.v, s.label]));

export const ISSUE_OPTS = [
  { v: "", label: "ทั้งหมด" },
  { v: "has", label: "มีปัญหา" },
  { v: "none", label: "ไม่มีปัญหา" },
  { v: "missing", label: "สินค้าขาดหาย" },
  { v: "damaged", label: "ชำรุด" },
  { v: "label_mismatch", label: "ข้อมูลหน้ากล่องไม่ตรง" },
  { v: "other", label: "อื่นๆ" },
];
export const ISSUE_LABEL: Record<string, string> = { missing: "สินค้าขาดหาย", damaged: "ชำรุด", label_mismatch: "ข้อมูลหน้ากล่องไม่ตรง", other: "อื่นๆ" };
export const QC_OPTS = [
  { v: "", label: "ทั้งหมด" },
  { v: "reimburse", label: "เบิกคืน (Reimburse)" },
  { v: "no_reimburse", label: "ไม่เบิกคืน" },
];
export const UNIT_OPTS = [
  { v: "", label: "ทั้งหมด" },
  { v: "kg", label: "kg" },
  { v: "g", label: "g" },
  { v: "pcs", label: "ชิ้น" },
];

export interface ReportFilters {
  preset: string;
  from: string; // YYYY-MM-DD
  to: string;
  basis: Basis;
  status: string[]; // empty = all except cancelled
  codes: string[];
  category: string;
  operator: string;
  supplier: string;
  issue: string;
  qc: string;
  unit: string;
  abnormal: boolean;
  cols: string[];
  /** product photos in the exported file: none / by photo position */
  pphoto: PhotoMode;
  /** which photo positions of each document go in the file (1 = ★ primary, then upload order), sorted */
  pslots: number[];
  /** issue photos + issue details in the exported file */
  iphoto: boolean;
}
export type PhotoMode = "none" | "primary";
export const PHOTO_MODE_LABEL: Record<PhotoMode, string> = { none: "ไม่ใส่", primary: "★ รูปหลัก" };
export const PHOTO_SLOTS = [1, 2, 3, 4] as const;
/** "★ รูปหลัก (1, 3)" — short text for buttons and file notes */
export function photoChoiceText(f: { pphoto: PhotoMode; pslots: number[] }): string {
  if (f.pphoto === "none" || !f.pslots.length) return "ไม่ใส่";
  return f.pslots.length === 1 && f.pslots[0] === 1 ? "★ รูปหลัก" : `รูป ${f.pslots.join(", ")}`;
}

export type Row = Record<string, any>;
type Kind = "text" | "int" | "dec" | "date" | "datetime";
export interface Col {
  key: string;
  label: string;
  group: "doc" | "qty" | "sap";
  kind: Kind;
  get: (r: Row) => string | number | null;
}

function skipText(r: Row): string | null {
  const parts = (
    [
      ["ต่อชิ้น", r.skip_per_pcs, r.skip_reason_per_pcs],
      ["ต่อถุง/ถาด", r.skip_per_inner, r.skip_reason_per_inner],
      ["ต่อลัง", r.skip_per_carton, r.skip_reason_per_carton],
    ] as [string, boolean, string | null][]
  )
    .filter(([, on]) => on)
    .map(([k, , why]) => (why ? `${k}: ${why}` : k));
  return parts.length ? parts.join(" · ") : null;
}
const num = (v: any) => (v === null || v === undefined || v === "" ? null : Number(v));
const round = (v: any, d = 2) => {
  const n = num(v);
  return n === null || !Number.isFinite(n) ? null : Math.round(n * 10 ** d) / 10 ** d;
};

export const COLUMNS: Col[] = [
  { key: "wh_number", label: "WH No.", group: "doc", kind: "text", get: (r) => r.wh_number },
  { key: "created_at", label: "วันที่สร้าง", group: "doc", kind: "date", get: (r) => r.created_at },
  { key: "delivery_date", label: "Delivery Date", group: "doc", kind: "date", get: (r) => r.delivery_date },
  { key: "po_number", label: "PO", group: "doc", kind: "text", get: (r) => r.po_number },
  { key: "lot", label: "LOT", group: "doc", kind: "text", get: (r) => r.lot },
  { key: "lot_number", label: "Lot Number", group: "doc", kind: "text", get: (r) => r.lot_number },
  { key: "mfg_date", label: "MFG", group: "doc", kind: "date", get: (r) => r.mfg_date },
  { key: "exp_date", label: "EXP", group: "doc", kind: "date", get: (r) => r.exp_date },
  { key: "item_code", label: "Item Code", group: "doc", kind: "text", get: (r) => r.item_code },
  { key: "description", label: "Description", group: "doc", kind: "text", get: (r) => r.description },
  { key: "product_category", label: "หมวดสินค้า", group: "doc", kind: "text", get: (r) => r.product_category },
  { key: "supplier", label: "ชื่อสินค้าฝั่ง Supplier", group: "doc", kind: "text", get: (r) => r.supplier },
  { key: "status", label: "สถานะ", group: "doc", kind: "text", get: (r) => (r.cancelled_at ? "ยกเลิก" : STATUS_LABEL[r.status] || r.status) },
  { key: "remarks", label: "หมายเหตุ", group: "doc", kind: "text", get: (r) => r.remarks },
  { key: "qty_per_carton", label: "ชิ้น/ลัง", group: "qty", kind: "int", get: (r) => num(r.qty_per_carton) },
  { key: "full_cartons", label: "ลังเต็ม", group: "qty", kind: "int", get: (r) => num(r.full_cartons) },
  { key: "remainder_pcs", label: "ชิ้นเศษ", group: "qty", kind: "int", get: (r) => num(r.remainder_pcs) },
  { key: "total_pcs", label: "ชิ้นรวม", group: "qty", kind: "int", get: (r) => num(r.total_pcs) },
  { key: "avg_pcs", label: "AVG/ชิ้น", group: "qty", kind: "dec", get: (r) => round(r.avg_pcs, 3) },
  { key: "minmax_pcs", label: "MIN–MAX ชิ้น", group: "qty", kind: "text", get: (r) => (r.min_pcs == null ? null : `${round(r.min_pcs, 3)} – ${round(r.max_pcs, 3)}`) },
  { key: "avg_inner", label: "AVG/ถุง-ถาด", group: "qty", kind: "dec", get: (r) => round(r.avg_inner, 3) },
  { key: "minmax_inner", label: "MIN–MAX ถุง-ถาด", group: "qty", kind: "text", get: (r) => (r.min_inner == null ? null : `${round(r.min_inner, 3)} – ${round(r.max_inner, 3)}`) },
  { key: "avg_carton", label: "AVG/ลัง", group: "qty", kind: "dec", get: (r) => round(r.avg_carton, 3) },
  { key: "minmax", label: "MIN–MAX ลัง", group: "qty", kind: "text", get: (r) => (r.min_carton == null ? null : `${round(r.min_carton, 3)} – ${round(r.max_carton, 3)}`) },
  { key: "weight_unit", label: "หน่วย", group: "qty", kind: "text", get: (r) => (r.weight_unit === "pcs" ? "ชิ้น" : r.weight_unit) },
  { key: "abnormal", label: "น้ำหนักผิดปกติ", group: "qty", kind: "text", get: (r) => (r.abnormal ? "⚠ ผิดปกติ" : "") },
  { key: "cartons_per_pallet", label: "ลัง/พาเลท", group: "qty", kind: "int", get: (r) => num(r.cartons_per_pallet) },
  { key: "box_size", label: "ขนาดกล่อง ก×ย×ส (ซม.)", group: "qty", kind: "text", get: (r) => (r.width_cm == null && r.length_cm == null && r.height_cm == null ? null : [r.width_cm, r.length_cm, r.height_cm].map((v) => (v == null ? "-" : round(v, 2))).join(" × ")) },
  { key: "gross_weight", label: "Gross Weight", group: "qty", kind: "dec", get: (r) => round(r.gross_weight, 3) },
  { key: "net_weight", label: "Net Weight", group: "qty", kind: "dec", get: (r) => round(r.net_weight, 3) },
  { key: "scale_name", label: "เครื่องชั่ง", group: "qty", kind: "text", get: (r) => r.scale_name },
  { key: "skips", label: "ข้ามการชั่ง (เหตุผล)", group: "qty", kind: "text", get: (r) => skipText(r) },
  { key: "sap_inbound_id", label: "CFSD", group: "sap", kind: "text", get: (r) => r.sap_inbound_id },
  { key: "sap_notification_id", label: "Notification ID", group: "sap", kind: "text", get: (r) => r.sap_notification_id },
  { key: "created_by_name", label: "ผู้ชั่ง", group: "sap", kind: "text", get: (r) => r.created_by_name },
  { key: "lead_time", label: "Lead Time", group: "sap", kind: "text", get: (r) => { const t = leadTimeText(r.started_at, r.closed_at || r.submitted_at || r.ended_at); return t === "-" ? null : t; } },
  { key: "closed_at", label: "วันที่ปิดงาน", group: "sap", kind: "datetime", get: (r) => r.closed_at },
  { key: "unlock_reason", label: "เหตุผลปลดล็อก", group: "sap", kind: "text", get: (r) => r.unlock_reason },
  { key: "qc_status", label: "QC", group: "sap", kind: "text", get: (r) => (r.qc_status === "reimburse" ? "เบิกคืน" : r.qc_status === "no_reimburse" ? "ไม่เบิกคืน" : r.qc_status) },
  { key: "issue_count", label: "จำนวนปัญหา", group: "sap", kind: "int", get: (r) => num(r.issue_count) },
  { key: "issue_types", label: "ประเภทปัญหา", group: "sap", kind: "text", get: (r) => (r.issue_types ? String(r.issue_types).split(",").map((t) => ISSUE_LABEL[t] || t).join(", ") : null) },
  { key: "photo_count", label: "รูปสินค้า", group: "sap", kind: "int", get: (r) => num(r.photo_count) },
];
export const COL_BY_KEY = Object.fromEntries(COLUMNS.map((c) => [c.key, c]));
export const GROUP_LABEL = { doc: "ข้อมูลเอกสาร", qty: "จำนวน / น้ำหนัก", sap: "SAP / ผู้ทำ / ปัญหา" } as const;

const DEFAULT_COLS = ["wh_number", "created_at", "po_number", "lot", "item_code", "description", "full_cartons", "total_pcs", "avg_pcs"];

export const PRESETS: { key: string; label: string; cols: string[]; set?: Partial<ReportFilters> }[] = [
  { key: "daily", label: "สรุปรับสินค้ารายวัน", cols: DEFAULT_COLS },
  { key: "abnormal", label: "น้ำหนักผิดปกติ", cols: ["wh_number", "created_at", "item_code", "description", "weight_unit", "avg_pcs", "avg_carton", "minmax", "abnormal", "created_by_name"], set: { abnormal: true } },
  { key: "pending", label: "รอเข้า SAP", cols: ["wh_number", "created_at", "po_number", "lot", "item_code", "description", "total_pcs", "created_by_name", "lead_time"], set: { status: ["pending_sap"] } },
  { key: "issues", label: "ปัญหาที่รายงาน", cols: ["wh_number", "created_at", "item_code", "description", "supplier", "issue_count", "issue_types", "created_by_name"], set: { issue: "has" } },
  { key: "person", label: "ผลงานรายคน", cols: ["created_by_name", "wh_number", "created_at", "item_code", "full_cartons", "total_pcs", "lead_time", "status"] },
];

function thaiToday(offsetDays = 0): string {
  const d = new Date(Date.now() + 7 * 3600000 + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}
export function monthStart(): string {
  return thaiToday().slice(0, 8) + "01";
}
export const QUICK_RANGES = (): { label: string; from: string; to: string }[] => {
  const t = thaiToday();
  const d = new Date(t + "T00:00:00Z");
  const prevMonthEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0));
  const prevMonthStart = new Date(Date.UTC(prevMonthEnd.getUTCFullYear(), prevMonthEnd.getUTCMonth(), 1));
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return [
    { label: "วันนี้", from: t, to: t },
    { label: "เมื่อวาน", from: thaiToday(-1), to: thaiToday(-1) },
    { label: "7 วันล่าสุด", from: thaiToday(-6), to: t },
    { label: "เดือนนี้", from: monthStart(), to: t },
    { label: "เดือนที่แล้ว", from: iso(prevMonthStart), to: iso(prevMonthEnd) },
    { label: "ปีนี้", from: t.slice(0, 4) + "-01-01", to: t },
  ];
};

type SP = { get(k: string): string | null; getAll(k: string): string[] };
export function toSP(o: Record<string, string | string[] | undefined>): SP {
  return {
    get: (k) => {
      const v = o[k];
      return v === undefined ? null : Array.isArray(v) ? v[0] ?? null : v;
    },
    getAll: (k) => {
      const v = o[k];
      return v === undefined ? [] : Array.isArray(v) ? v : [v];
    },
  };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
function parseSlots(sp: SP): number[] {
  if (sp.get("pphoto") === "all") return [1, 2, 3, 4]; // old "all photos" links
  const v = Array.from(new Set(sp.getAll("pslot").map(Number).filter((n) => n >= 1 && n <= 4))).sort((a, b) => a - b);
  return v.length ? v : [1];
}
export function parseFilters(sp: SP): ReportFilters {
  const presetKey = sp.get("preset") || "daily";
  const preset = PRESETS.find((p) => p.key === presetKey) || PRESETS[0];
  const has = (k: string) => sp.get(k) !== null;
  const cols = sp.getAll("cols").filter((c) => COL_BY_KEY[c]);
  const status = sp.getAll("status").filter((s) => STATUS_LABEL[s]);
  const f: ReportFilters = {
    preset: preset.key,
    from: DATE.test(sp.get("from") || "") ? sp.get("from")! : monthStart(),
    to: DATE.test(sp.get("to") || "") ? sp.get("to")! : thaiToday(),
    basis: (["created_at", "submitted_at", "closed_at", "delivery_date"].includes(sp.get("basis") || "") ? sp.get("basis") : "created_at") as Basis,
    status: has("applied") ? status : preset.set?.status ?? status,
    codes: (sp.get("codes") || "").split(/[\s,]+/).map((s) => s.trim()).filter(Boolean).slice(0, 50),
    category: sp.get("category") || "",
    operator: sp.get("operator") || "",
    supplier: (sp.get("supplier") || "").trim(),
    issue: has("applied") ? sp.get("issue") || "" : preset.set?.issue ?? sp.get("issue") ?? "",
    qc: sp.get("qc") || "",
    unit: sp.get("unit") || "",
    abnormal: has("applied") ? sp.get("abnormal") === "1" : preset.set?.abnormal ?? sp.get("abnormal") === "1",
    cols: cols.length ? cols : preset.cols,
    // absent = default (★ primary, issues on) so links and templates saved before these options keep working
    pphoto: sp.get("pphoto") === "none" ? "none" : "primary",
    pslots: parseSlots(sp),
    iphoto: sp.get("noiphoto") !== "1",
  };
  return f;
}

export function toQuery(f: ReportFilters, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams();
  q.set("preset", f.preset);
  q.set("from", f.from);
  q.set("to", f.to);
  q.set("basis", f.basis);
  f.status.forEach((s) => q.append("status", s));
  if (f.codes.length) q.set("codes", f.codes.join(","));
  if (f.category) q.set("category", f.category);
  if (f.operator) q.set("operator", f.operator);
  if (f.supplier) q.set("supplier", f.supplier);
  if (f.issue) q.set("issue", f.issue);
  if (f.qc) q.set("qc", f.qc);
  if (f.unit) q.set("unit", f.unit);
  if (f.abnormal) q.set("abnormal", "1");
  f.cols.forEach((c) => q.append("cols", c));
  if (f.pphoto !== "primary") q.set("pphoto", f.pphoto);
  if (!(f.pslots.length === 1 && f.pslots[0] === 1)) f.pslots.forEach((n) => q.append("pslot", String(n)));
  if (!f.iphoto) q.set("noiphoto", "1");
  q.set("applied", "1");
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  return q.toString();
}

function nextDay(d: string): string {
  return new Date(Date.parse(d + "T00:00:00Z") + 86400000).toISOString().slice(0, 10);
}

/** All matching rows (paged past PostgREST's 1000-row cap). */
export async function fetchReportRows(supabase: SupabaseClient<any>, f: ReportFilters, max = 20000): Promise<Row[]> {
  const out: Row[] = [];
  const PAGE = 1000;
  for (let off = 0; off < max; off += PAGE) {
    let q: any = supabase.from("report_docs").select("*");
    if (f.basis === "delivery_date") q = q.gte("delivery_date", f.from).lte("delivery_date", f.to);
    else q = q.gte(f.basis, `${f.from}T00:00:00+07:00`).lt(f.basis, `${nextDay(f.to)}T00:00:00+07:00`);
    const live = f.status.filter((s) => s !== "cancelled");
    const wantCancelled = f.status.includes("cancelled");
    if (!f.status.length) q = q.is("cancelled_at", null);
    else if (wantCancelled && live.length) q = q.or(`and(cancelled_at.is.null,status.in.(${live.join(",")})),cancelled_at.not.is.null`);
    else if (wantCancelled) q = q.not("cancelled_at", "is", null);
    else q = q.is("cancelled_at", null).in("status", live);
    if (f.codes.length) q = q.in("item_code", f.codes);
    if (f.category) q = q.eq("product_category", f.category);
    if (f.operator) q = q.eq("created_by", f.operator);
    if (f.supplier) q = q.ilike("supplier", `%${f.supplier.replace(/[%_\\]/g, "\\$&")}%`);
    if (f.issue === "has") q = q.gt("issue_count", 0);
    else if (f.issue === "none") q = q.eq("issue_count", 0);
    else if (f.issue) q = q.ilike("issue_types", `%${f.issue}%`);
    if (f.qc) q = q.eq("qc_status", f.qc);
    if (f.unit) q = q.eq("weight_unit", f.unit);
    if (f.abnormal) q = q.eq("abnormal", true);
    const { data, error } = await q.order("created_at", { ascending: false }).order("id").range(off, off + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export interface Summary {
  docs: number;
  completed: number;
  pending: number;
  inProgress: number;
  cancelled: number;
  cartons: number;
  pcs: number;
  issueDocs: number;
  abnormal: number;
  avgLead: string;
  topItems: { code: string; desc: string; docs: number; pcs: number }[];
  byItem: { code: string; desc: string; category: string; docs: number; cartons: number; pcs: number; issues: number }[];
}

export function summarize(rows: Row[]): Summary {
  let cartons = 0, pcs = 0, leadSum = 0, leadN = 0;
  const items = new Map<string, Summary["byItem"][number]>();
  for (const r of rows) {
    cartons += Number(r.full_cartons) || 0;
    pcs += Number(r.total_pcs) || 0;
    const end = r.closed_at || r.submitted_at || r.ended_at;
    if (r.started_at && end) {
      leadSum += leadTimeMinutes(r.started_at, end);
      leadN++;
    }
    const k = r.item_code || "(ไม่ระบุ)";
    const it = items.get(k) || { code: k, desc: r.description || "", category: r.product_category || "", docs: 0, cartons: 0, pcs: 0, issues: 0 };
    it.docs++;
    it.cartons += Number(r.full_cartons) || 0;
    it.pcs += Number(r.total_pcs) || 0;
    it.issues += Number(r.issue_count) || 0;
    items.set(k, it);
  }
  const byItem = Array.from(items.values()).sort((a, b) => b.docs - a.docs || b.pcs - a.pcs);
  const m = leadN ? Math.round(leadSum / leadN) : 0;
  return {
    docs: rows.length,
    completed: rows.filter((r) => !r.cancelled_at && r.status === "completed").length,
    pending: rows.filter((r) => !r.cancelled_at && r.status === "pending_sap").length,
    inProgress: rows.filter((r) => !r.cancelled_at && r.status === "in_progress").length,
    cancelled: rows.filter((r) => r.cancelled_at).length,
    cartons,
    pcs,
    issueDocs: rows.filter((r) => Number(r.issue_count) > 0).length,
    abnormal: rows.filter((r) => r.abnormal).length,
    avgLead: leadN ? (m < 60 ? `${m} นาที` : `${Math.floor(m / 60)} ชม. ${m % 60} นาที`) : "-",
    topItems: byItem.slice(0, 5).map((i) => ({ code: i.code, desc: i.desc, docs: i.docs, pcs: i.pcs })),
    byItem,
  };
}

/** Thai date (dd/mm/yyyy) for ISO timestamps; date strings stay as given. */
export function fmtCell(c: Col, v: any): string {
  if (v === null || v === undefined || v === "") return "";
  if (c.kind === "date" || c.kind === "datetime") {
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
    const d = new Date(Date.parse(s) + 7 * 3600000).toISOString();
    const date = `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
    return c.kind === "datetime" ? `${date} ${d.slice(11, 16)}` : date;
  }
  if (c.kind === "int") return Number(v).toLocaleString("en-US");
  if (c.kind === "dec") return Number(v).toLocaleString("en-US", { maximumFractionDigits: 3 });
  return String(v);
}

export function describeFilters(f: ReportFilters, names: { operator?: string } = {}): string[] {
  const d = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
  const out = [
    `ช่วงวันที่ (${BASIS_LABEL[f.basis]}): ${d(f.from)} – ${d(f.to)}`,
    `สถานะ: ${f.status.length ? f.status.map((s) => STATUS_LABEL[s]).join(", ") : "ทั้งหมด (ไม่รวมใบที่ยกเลิก)"}`,
  ];
  if (f.codes.length) out.push(`Item Code: ${f.codes.join(", ")}`);
  if (f.category) out.push(`หมวดสินค้า: ${f.category}`);
  if (f.operator) out.push(`ผู้ชั่ง: ${names.operator || f.operator}`);
  if (f.supplier) out.push(`ชื่อสินค้าฝั่ง Supplier มีคำว่า: ${f.supplier}`);
  if (f.issue) out.push(`ปัญหา: ${ISSUE_OPTS.find((o) => o.v === f.issue)?.label}`);
  if (f.qc) out.push(`QC: ${QC_OPTS.find((o) => o.v === f.qc)?.label}`);
  if (f.unit) out.push(`หน่วย: ${UNIT_OPTS.find((o) => o.v === f.unit)?.label}`);
  if (f.abnormal) out.push("เฉพาะใบที่น้ำหนักผิดปกติ (ต่างจากค่าเฉลี่ยเกิน 10%)");
  return out;
}

/** Every condition as [label, value] — including the ones left at "all" — for the confirm dialog and file headers. */
export function filterPairs(f: ReportFilters, names: { operator?: string } = {}): [string, string][] {
  const d = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
  const opt = (list: { v: string; label: string }[], v: string) => list.find((o) => o.v === v)?.label || v;
  return [
    ["รูปแบบ", PRESETS.find((p) => p.key === f.preset)?.label || "-"],
    ["ช่วงวันที่", `${d(f.from)} – ${d(f.to)}`],
    ["นับวันที่จาก", BASIS_LABEL[f.basis]],
    ["สถานะ", f.status.length ? f.status.map((s) => STATUS_LABEL[s]).join(", ") : "ทั้งหมด (ไม่รวมใบที่ยกเลิก)"],
    ["Item Code", f.codes.length ? f.codes.join(", ") : "ทุกรายการ"],
    ["หมวดสินค้า", f.category || "ทุกหมวด"],
    ["ผู้ชั่ง", f.operator ? names.operator || f.operator : "ทุกคน"],
    ["ชื่อสินค้าฝั่ง Supplier", f.supplier ? `มีคำว่า "${f.supplier}"` : "ทั้งหมด"],
    ["ปัญหาที่รายงาน", f.issue ? opt(ISSUE_OPTS, f.issue) : "ทั้งหมด"],
    ["สถานะ QC", f.qc ? opt(QC_OPTS, f.qc) : "ทั้งหมด"],
    ["หน่วยวัด", f.unit ? opt(UNIT_OPTS, f.unit) : "ทั้งหมด"],
    ["น้ำหนักผิดปกติ", f.abnormal ? "เฉพาะใบที่ผิดปกติ" : "ไม่กรอง"],
  ];
}

export function reportFileBase(f: ReportFilters): string {
  const p = PRESETS.find((x) => x.key === f.preset)?.label || "Report";
  return `Report_${p.replace(/\s+/g, "")}_${f.from}_ถึง_${f.to}`;
}
