import { redirect } from "next/navigation";
import Link from "next/link";
import { clsx } from "clsx";
import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { TopAppBar } from "@/components/TopAppBar";
import { BottomNav } from "@/components/BottomNav";
import { Icon } from "@/components/Icon";
import { fmtDateTime } from "@/lib/stats";
import { cancelReasonText } from "@/lib/cancelDocs";
import { EVENT_LABEL, activityTitle, activityDetails, eventDetail, isLogViewer } from "@/lib/activityLog";
import { LogExportButton, type LogExportRow } from "./LogExportButton";

type Tab = "events" | "changes" | "logins" | "cancelled";
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "events", label: "เหตุการณ์", icon: "event_note" },
  { key: "changes", label: "ข้อมูลที่เปลี่ยน", icon: "edit_note" },
  { key: "logins", label: "เข้าสู่ระบบ", icon: "login" },
  { key: "cancelled", label: "ใบที่ยกเลิก", icon: "block" },
];
const LIMIT = 500;

/** YYYY-MM-DD in Bangkok time */
function thDate(d: Date): string {
  return new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}
/** Bangkok-midnight ISO for a YYYY-MM-DD string */
function thStartISO(ymd: string): string {
  return new Date(`${ymd}T00:00:00+07:00`).toISOString();
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams: { tab?: string; from?: string; to?: string; user?: string; q?: string };
}) {
  const { profile } = await getCurrentUserAndProfile();
  if (!profile) redirect("/login");

  const tab: Tab = (TABS.find((t) => t.key === searchParams.tab)?.key ?? "events") as Tab;
  const today = thDate(new Date());
  const from = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.from || "") ? searchParams.from! : thDate(new Date(Date.now() - 6 * 86400_000));
  const to = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.to || "") ? searchParams.to! : today;
  const fromISO = thStartISO(from);
  const toISO = new Date(new Date(thStartISO(to)).getTime() + 86400_000).toISOString();
  const user = searchParams.user || "";
  const q = (searchParams.q || "").trim().toUpperCase();

  const supabase = createClient();
  if (!(await isLogViewer(supabase, profile.id))) redirect("/home");
  const { data: people } = await supabase.from("profiles").select("id,full_name,role").order("full_name");
  const nameOf = (id: string | null | undefined) => (id ? people?.find((p) => p.id === id)?.full_name || "ผู้ใช้ที่ถูกลบ" : "ระบบ");

  let rows: { key: string; at: string; who: string; title: string; wh?: string | null; docId?: string | null; lines: string[]; tone?: "red" | "green" }[] = [];
  let note: string | null = null;

  // WH filter → document ids (admin also sees cancelled documents)
  let docIdsForQ: string[] | null = null;
  if (q && (tab === "events")) {
    const { data } = await supabase.from("gr_documents").select("id").ilike("wh_number", `%${q}%`).limit(200);
    docIdsForQ = (data || []).map((d) => d.id);
  }

  if (tab === "events") {
    let query = supabase
      .from("audit_log")
      .select("id,action,detail,actor,created_at,document_id")
      .gte("created_at", fromISO)
      .lt("created_at", toISO)
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    if (user) query = query.eq("actor", user);
    if (docIdsForQ) query = query.in("document_id", docIdsForQ.length ? docIdsForQ : ["00000000-0000-0000-0000-000000000000"]);
    const { data, error } = await query;
    if (error) note = error.message;
    const ids = Array.from(new Set((data || []).map((r) => r.document_id).filter(Boolean))) as string[];
    const whMap: Record<string, string> = {};
    for (let i = 0; i < ids.length; i += 150) {
      const { data: docs } = await supabase.from("gr_documents").select("id,wh_number").in("id", ids.slice(i, i + 150));
      for (const d of docs || []) whMap[d.id] = d.wh_number;
    }
    rows = (data || []).map((r) => ({
      key: "e" + r.id,
      at: r.created_at,
      who: nameOf(r.actor),
      title: EVENT_LABEL[r.action] || r.action,
      wh: r.document_id ? whMap[r.document_id] || "(ใบงานถูกลบ)" : null,
      docId: r.document_id,
      lines: [eventDetail(r.action, r.detail)].filter(Boolean),
      tone: r.action === "cancel_doc" ? "red" : r.action === "restore_doc" || r.action === "complete_sap" ? "green" : undefined,
    }));
  } else if (tab === "changes") {
    let query = supabase
      .from("activity_log")
      .select("id,at,actor,tbl,op,document_id,wh_number,changes")
      .gte("at", fromISO)
      .lt("at", toISO)
      .order("at", { ascending: false })
      .limit(LIMIT);
    if (user) query = query.eq("actor", user);
    if (q) query = query.ilike("wh_number", `%${q}%`);
    const { data, error } = await query;
    if (error) note = /activity_log/.test(error.message) ? "ยังไม่ได้รัน SQL 0010 — ยังไม่มีตารางประวัติการเปลี่ยนแปลง" : error.message;
    rows = (data || []).map((r) => {
      const title = activityTitle(r);
      return {
        key: "c" + r.id,
        at: r.at,
        who: nameOf(r.actor),
        title,
        wh: r.wh_number,
        docId: r.document_id,
        lines: activityDetails(r),
        tone: r.op === "DELETE" || title === "ยกเลิกใบงาน" ? "red" : r.op === "INSERT" ? "green" : undefined,
      };
    });
  } else if (tab === "logins") {
    const { data, error } = await supabase.rpc("admin_login_history", { p_from: fromISO, p_to: toISO });
    if (error) note = /admin_login_history/.test(error.message) ? "ยังไม่ได้รัน SQL 0010 — ยังดูประวัติการเข้าสู่ระบบไม่ได้" : error.message;
    rows = ((data || []) as { at: string; user_id: string | null; email: string; ip: string | null }[])
      .filter((r) => !user || r.user_id === user)
      .map((r, i) => ({
        key: "l" + i,
        at: r.at,
        who: r.user_id ? nameOf(r.user_id) : r.email,
        title: "เข้าสู่ระบบ",
        lines: [`รหัส ${String(r.email || "").replace("@comets.local", "").toUpperCase()}`, r.ip ? `IP ${r.ip}` : ""].filter(Boolean),
      }));
    if (!error && rows.length === 0) note = note || "ไม่พบประวัติการเข้าสู่ระบบในช่วงวันที่นี้";
  } else {
    let query = supabase
      .from("gr_documents")
      .select("id,wh_number,status,item_code,description,po_number,lot,created_by,cancelled_at,cancelled_by,cancel_reason,cancel_dup_wh,cancel_note")
      .not("cancelled_at", "is", null)
      .gte("cancelled_at", fromISO)
      .lt("cancelled_at", toISO)
      .order("cancelled_at", { ascending: false })
      .limit(LIMIT);
    if (user) query = query.eq("cancelled_by", user);
    if (q) query = query.ilike("wh_number", `%${q}%`);
    const { data, error } = await query;
    if (error) note = error.message;
    rows = (data || []).map((d) => ({
      key: "x" + d.id,
      at: d.cancelled_at as string,
      who: nameOf(d.cancelled_by),
      title: "ยกเลิกใบงาน",
      wh: d.wh_number,
      docId: d.id,
      lines: [
        cancelReasonText(d.cancel_reason, d.cancel_dup_wh, d.cancel_note),
        `${d.item_code || "-"} · PO ${d.po_number || "-"} · LOT ${d.lot || "-"} · สร้างโดย ${nameOf(d.created_by)}`,
      ],
      tone: "red",
    }));
  }

  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ tab, from, to, ...(user ? { user } : {}), ...(q ? { q } : {}), ...patch });
    return `/logs?${p.toString()}`;
  };
  const exportRows: LogExportRow[] = rows.map((r) => ({
    เวลา: fmtDateTime(r.at),
    ผู้ใช้: r.who,
    การกระทำ: r.title,
    ใบงาน: r.wh || "",
    รายละเอียด: r.lines.join(" | "),
  }));

  return (
    <>
      <TopAppBar title="Log การใช้งาน" subtitle="ประวัติการทำงานทั้งหมด" />
      <main className="mt-16 pb-32 px-4 flex flex-col gap-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={qs({ tab: t.key })}
              className={clsx(
                "flex-none inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold",
                t.key === tab ? "bg-primary-container text-white" : "bg-surface-container text-on-surface-variant"
              )}
            >
              <Icon name={t.icon} className="text-base" /> {t.label}
            </Link>
          ))}
        </div>

        <form action="/logs" method="get" className="card grid grid-cols-2 gap-2">
          <input type="hidden" name="tab" value={tab} />
          <label className="text-[11px] text-outline">
            ตั้งแต่
            <input type="date" name="from" defaultValue={from} className="input-base mt-1" />
          </label>
          <label className="text-[11px] text-outline">
            ถึง
            <input type="date" name="to" defaultValue={to} className="input-base mt-1" />
          </label>
          <label className="text-[11px] text-outline col-span-2">
            ผู้ใช้
            <select name="user" defaultValue={user} className="input-base mt-1">
              <option value="">ทุกคน</option>
              {(people || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.role})
                </option>
              ))}
            </select>
          </label>
          {tab !== "logins" && (
            <label className="text-[11px] text-outline col-span-2">
              เลข WH
              <input name="q" defaultValue={q} placeholder="เช่น WH-2611-073" className="input-base mt-1 uppercase" />
            </label>
          )}
          <button type="submit" className="btn-primary col-span-2 h-11">
            <Icon name="search" /> ค้นหา
          </button>
        </form>

        <div className="flex items-center justify-between">
          <p className="text-xs text-outline">
            {rows.length.toLocaleString()} รายการ{rows.length >= LIMIT ? ` (แสดง ${LIMIT} รายการล่าสุด — ใช้ตัวกรองเพื่อดูเพิ่ม)` : ""}
          </p>
          <LogExportButton rows={exportRows} filename={`log-${tab}-${from}_${to}.csv`} />
        </div>
        {tab === "changes" && (
          <p className="text-[11px] text-outline -mt-2">บันทึกทุกการเพิ่ม/แก้/ลบ ข้อมูลอัตโนมัติ (เริ่มเก็บตั้งแต่รัน SQL 0010) — แก้ไขหรือลบประวัติไม่ได้</p>
        )}
        {note && <div className="card text-sm text-on-surface-variant">{note}</div>}

        {rows.map((r) => (
          <div key={r.key} className={clsx("card border-l-4", r.tone === "red" ? "border-error" : r.tone === "green" ? "border-green-600" : "border-outline-variant")}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold">{r.title}</p>
                <p className="text-[11px] text-outline">
                  {r.who} · {fmtDateTime(r.at)}
                </p>
              </div>
              {r.wh &&
                (r.docId ? (
                  <Link href={`/admin/${r.docId}`} className="text-xs font-bold text-primary underline flex-none">
                    {r.wh}
                  </Link>
                ) : (
                  <span className="text-xs font-bold flex-none">{r.wh}</span>
                ))}
            </div>
            {r.lines.length > 0 && (
              <ul className="mt-1 text-xs text-on-surface-variant list-disc pl-4">
                {r.lines.map((l, i) => (
                  <li key={i} className="break-words">
                    {l}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {rows.length === 0 && !note && <div className="card text-center text-outline text-sm py-8">ไม่มีรายการในช่วงที่เลือก</div>}
      </main>
      <BottomNav role={profile.role} />
    </>
  );
}
