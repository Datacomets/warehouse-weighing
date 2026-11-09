"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clsx } from "clsx";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/Icon";
import { StatusBadge } from "@/components/StatusBadge";
import { useConfirm } from "@/components/ConfirmDialog";
import { fmtDateTime } from "@/lib/stats";
import type { DocStatus } from "@/lib/types";
import {
  CANCEL_REASONS,
  CANCEL_NOTE_MAX,
  cancelDocuments,
  restoreDocuments,
  validateCancelItem,
  cancelReasonText,
  normalizeWh,
  type CancelItemInput,
  type CancelReason,
  type CancelResult,
} from "@/lib/cancelDocs";

export interface CancelDoc {
  id: string;
  wh_number: string;
  status: DocStatus;
  item_code: string | null;
  description: string | null;
  po_number: string | null;
  lot: string | null;
  created_at: string;
  created_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  cancel_dup_wh: string | null;
  cancel_note: string | null;
}

type Step = "select" | "reason" | "result";
type Tab = "active" | "cancelled";

export function CancelManager({
  active,
  cancelled,
  names,
  preselect,
  initialTab,
}: {
  active: CancelDoc[];
  cancelled: CancelDoc[];
  names: Record<string, string>;
  preselect: string[];
  initialTab: Tab;
}) {
  const router = useRouter();
  const supabase = createClient();
  const pre = preselect.filter((id) => active.some((d) => d.id === id));

  const [tab, setTab] = useState<Tab>(initialTab);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set(pre));
  const [step, setStep] = useState<Step>(pre.length ? "reason" : "select");
  const [mode, setMode] = useState<"same" | "each">("same");
  const [same, setSame] = useState<{ reason: CancelReason | ""; dupWh: string; note: string }>({ reason: "", dupWh: "", note: "" });
  const [each, setEach] = useState<Record<string, { reason: CancelReason | ""; dupWh: string; note: string }>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [results, setResults] = useState<CancelResult[] | null>(null);
  const [resultKind, setResultKind] = useState<"cancel" | "restore" | "undo">("cancel");
  const [whExists, setWhExists] = useState<Record<string, boolean>>({});
  const checking = useRef(new Set<string>());
  const { confirm, DialogElement } = useConfirm();

  const list = tab === "active" ? active : cancelled;
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return list;
    return list.filter((d) =>
      [d.wh_number, d.po_number, d.item_code, d.lot, d.description].some((v) => (v || "").toLowerCase().includes(t))
    );
  }, [list, q]);

  const chosen = active.filter((d) => selected.has(d.id));
  const selectedWhs = useMemo(() => new Set(chosen.map((d) => normalizeWh(d.wh_number))), [chosen]);

  const items: CancelItemInput[] = chosen.map((d) => {
    const v = mode === "same" ? same : each[d.id] || { reason: "", dupWh: "", note: "" };
    return { id: d.id, wh: d.wh_number, reason: v.reason, dupWh: v.dupWh, note: v.note };
  });
  const errors = items.map((i) => validateCancelItem(i, selectedWhs, (wh) => whExists[wh]));
  const allValid = items.length > 0 && errors.every((e) => !e);

  // look up duplicate WH numbers as they are typed (debounced)
  const dupWhs = Array.from(new Set(items.filter((i) => i.reason === "duplicate").map((i) => normalizeWh(i.dupWh))))
    .filter((wh) => /^WH-\d{4}-\d{3,}$/.test(wh));
  const dupKey = dupWhs.join("|");
  useEffect(() => {
    const todo = dupWhs.filter((wh) => !(wh in whExists) && !checking.current.has(wh));
    if (!todo.length) return;
    const t = setTimeout(async () => {
      todo.forEach((wh) => checking.current.add(wh));
      const { data } = await supabase.from("gr_documents").select("wh_number").in("wh_number", todo);
      const found = new Set((data || []).map((r: { wh_number: string }) => r.wh_number));
      setWhExists((m) => {
        const n = { ...m };
        todo.forEach((wh) => (n[wh] = found.has(wh)));
        return n;
      });
      todo.forEach((wh) => checking.current.delete(wh));
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dupKey]);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function switchTab(t: Tab) {
    setTab(t);
    setSelected(new Set());
    setQ("");
  }
  function resetAll() {
    setStep("select");
    setSelected(new Set());
    setSame({ reason: "", dupWh: "", note: "" });
    setEach({});
    setResults(null);
    setErr(null);
    router.refresh();
  }

  async function doCancel() {
    const n = chosen.length;
    const ok = await confirm({
      title: `ยืนยันยกเลิกใบงาน ${n} ใบ?`,
      message: `${chosen.map((d) => d.wh_number).join(", ")} — ใบงานจะหายจากรายการของทุกคน (ข้อมูลยังเก็บไว้ กู้คืนได้)`,
      confirmLabel: "ยืนยันยกเลิก",
      cancelLabel: "ไม่ยกเลิก",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    setErr(null);
    const res = await cancelDocuments(supabase, items);
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    setResults(res.results);
    setResultKind("cancel");
    setStep("result");
  }
  async function doRestore(ids: string[], kind: "restore" | "undo") {
    setBusy(true);
    setErr(null);
    const res = await restoreDocuments(supabase, ids);
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    setResults(res.results);
    setResultKind(kind);
    setStep("result");
  }

  // ───────────────────────── step: result ─────────────────────────
  if (step === "result" && results) {
    const ok = results.filter((r) => r.ok);
    const bad = results.filter((r) => !r.ok);
    const verb = resultKind === "cancel" ? "ยกเลิก" : "กู้คืน";
    return (
      <div className="flex flex-col gap-3">
        <div className={clsx("card", bad.length ? "bg-[#fff8ec] border border-tertiary-fixed" : "bg-[#dcf3e3]")}>
          <p className="font-bold">
            {resultKind === "undo" ? "เลิกทำแล้ว — " : ""}
            {verb}สำเร็จ {ok.length} ใบ{bad.length ? ` · ไม่สำเร็จ ${bad.length} ใบ` : ""}
          </p>
        </div>
        <div className="card flex flex-col divide-y divide-surface-container-high">
          {results.map((r) => (
            <div key={r.id} className="py-2 flex items-start justify-between gap-2">
              <b className="text-sm">{r.wh || r.id.slice(0, 8)}</b>
              {r.ok ? (
                <span className="text-xs font-bold text-green-700">✓ {verb}แล้ว</span>
              ) : (
                <span className="text-xs font-bold text-error text-right">✕ {r.error}</span>
              )}
            </div>
          ))}
        </div>
        {bad.length > 0 && resultKind === "cancel" && (
          <p className="text-[11px] text-outline">ใบที่ไม่สำเร็จจะไม่ถูกเปลี่ยนแปลงใด ๆ · ถ้าต้องแก้ข้อมูลให้ใช้ "แก้ไขข้อมูล" แทน</p>
        )}
        {err && <p className="text-xs text-error">{err}</p>}
        {resultKind === "cancel" && ok.length > 0 && (
          <button type="button" disabled={busy} onClick={() => doRestore(ok.map((r) => r.id), "undo")} className="btn-secondary w-full">
            <Icon name="undo" /> เลิกทำ (กู้คืน {ok.length} ใบ)
          </button>
        )}
        <button type="button" onClick={resetAll} className="btn-primary w-full">
          กลับหน้ารายการ
        </button>
      </div>
    );
  }

  // ───────────────────────── step: reason ─────────────────────────
  if (step === "reason") {
    return (
      <div className="flex flex-col gap-3">
        {DialogElement}
        <p className="text-[11px] text-outline">เลือกเหตุผล แล้วกดปุ่มยกเลิกด้านล่าง ({chosen.length} ใบ)</p>
        {chosen.length > 1 && (
          <div className="card flex flex-col gap-2">
            <ModeOption on={mode === "same"} onClick={() => setMode("same")} title="ใช้เหตุผลเดียวกันทุกใบ" hint={`ใช้กับทั้ง ${chosen.length} ใบที่เลือก`} />
            <ModeOption on={mode === "each"} onClick={() => setMode("each")} title="กำหนดเหตุผลแยกแต่ละใบ" hint="เช่น แต่ละใบซ้ำกับคนละใบ" />
          </div>
        )}
        {mode === "same" || chosen.length === 1 ? (
          <div className="card">
            <ReasonFields value={same} onChange={setSame} error={errors.find((e) => e) || null} />
            <span className="section-title mt-3 block">ใบงานที่เลือก ({chosen.length})</span>
            {chosen.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-1.5 border-b border-surface-container-high last:border-0">
                <b className="text-sm">{d.wh_number}</b>
                <StatusBadge status={d.status} />
              </div>
            ))}
          </div>
        ) : (
          chosen.map((d, idx) => (
            <div key={d.id} className="card">
              <div className="flex items-center justify-between mb-1">
                <b>{d.wh_number}</b>
                <StatusBadge status={d.status} />
              </div>
              <ReasonFields
                value={each[d.id] || { reason: "", dupWh: "", note: "" }}
                onChange={(v) => setEach((m) => ({ ...m, [d.id]: v }))}
                error={errors[idx]}
              />
            </div>
          ))
        )}
        <div className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-background via-background to-transparent px-4 py-4 z-30 flex flex-col gap-2">
          {err && <p className="text-xs text-error">{err}</p>}
          <button
            type="button"
            disabled={!allValid || busy}
            onClick={doCancel}
            className="w-full rounded-xl py-3 font-bold text-white bg-error disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Icon name="block" /> {busy ? "กำลังยกเลิก..." : `ยกเลิกใบงาน ${chosen.length} ใบ`}
          </button>
          <button type="button" onClick={() => setStep("select")} className="text-sm text-outline py-1">
            ← กลับไปเลือกใบงาน
          </button>
        </div>
      </div>
    );
  }

  // ───────────────────────── step: select ─────────────────────────
  return (
    <div className="flex flex-col gap-3">
      {DialogElement}
      <div className="flex gap-2">
        <TabBtn on={tab === "active"} onClick={() => switchTab("active")}>ยกเลิกได้ ({active.length})</TabBtn>
        <TabBtn on={tab === "cancelled"} onClick={() => switchTab("cancelled")}>ยกเลิกแล้ว ({cancelled.length})</TabBtn>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} className="input-base" placeholder="ค้นหา WH, PO, Item Code, LOT, Description…" />
      <p className="text-[11px] text-outline">
        {tab === "active"
          ? "แสดงเฉพาะใบที่ยังไม่นำเข้า SAP (กำลังดำเนินการ / รอนำเข้า SAP) — ใบที่นำเข้า SAP แล้วยกเลิกไม่ได้"
          : "ใบที่ยกเลิกแล้ว ผู้ใช้อื่นมองไม่เห็น — เลือกแล้วกด \"กู้คืน\" เพื่อนำกลับมา"}
      </p>
      {filtered.length === 0 && <div className="card text-center text-outline text-sm py-8">ไม่มีใบงานในหมวดนี้</div>}
      {filtered.map((d) => {
        const on = selected.has(d.id);
        return (
          <div
            key={d.id}
            role="checkbox"
            aria-checked={on}
            tabIndex={0}
            onClick={() => toggle(d.id)}
            onKeyDown={(e) => (e.key === " " || e.key === "Enter") && (e.preventDefault(), toggle(d.id))}
            className={clsx("card flex gap-3 items-start cursor-pointer select-none", on && "ring-2 ring-primary-container bg-[#f2f3ff]")}
          >
            <span className={clsx("w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center flex-none", on ? "bg-primary-container border-primary-container text-white" : "border-outline")}>
              {on && <Icon name="check" className="text-sm" />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <b className={clsx("text-primary", tab === "cancelled" && "line-through text-outline")}>{d.wh_number}</b>
                {tab === "active" ? (
                  <StatusBadge status={d.status} />
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-container-high text-on-surface-variant">ยกเลิกแล้ว</span>
                )}
              </div>
              <p className="text-[11px] text-outline truncate">{d.item_code} · {d.description}</p>
              <p className="text-[11px] text-outline">
                PO {d.po_number || "-"} · LOT {d.lot || "-"} · {names[d.created_by || ""] || "-"} · {fmtDateTime(d.created_at)}
              </p>
              {tab === "cancelled" && (
                <p className="text-[11px] text-error">
                  {cancelReasonText(d.cancel_reason, d.cancel_dup_wh, d.cancel_note)} · โดย {names[d.cancelled_by || ""] || "-"} · {fmtDateTime(d.cancelled_at)}
                </p>
              )}
            </div>
          </div>
        );
      })}
      {tab === "active" && (
        <Link href="/home" className="text-xs text-outline text-center py-2">ดูใบงานทั้งหมดที่หน้าเอกสาร</Link>
      )}
      {err && <p className="text-xs text-error">{err}</p>}
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-surface-container-high px-4 py-3 z-30">
        {tab === "active" ? (
          <button
            type="button"
            disabled={selected.size === 0}
            onClick={() => setStep("reason")}
            className="w-full rounded-xl py-3 font-bold text-white bg-error disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Icon name="block" /> ยกเลิกใบงานที่เลือก ({selected.size})
          </button>
        ) : (
          <button
            type="button"
            disabled={selected.size === 0 || busy}
            onClick={async () => {
              const ok = await confirm({
                title: `กู้คืนใบงาน ${selected.size} ใบ?`,
                message: "ใบงานจะกลับมาแสดงตามปกติสำหรับทุกคน",
                confirmLabel: "กู้คืน",
                cancelLabel: "ไม่กู้คืน",
              });
              if (ok) doRestore(Array.from(selected), "restore");
            }}
            className="btn-primary w-full disabled:opacity-40"
          >
            <Icon name="restore" /> {busy ? "กำลังกู้คืน..." : `กู้คืนใบงานที่เลือก (${selected.size})`}
          </button>
        )}
      </div>
    </div>
  );
}

function TabBtn({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={clsx("px-3 py-1.5 rounded-full text-xs font-bold", on ? "bg-primary-container text-white" : "bg-surface-container text-on-surface-variant")}>
      {children}
    </button>
  );
}

function ModeOption({ on, onClick, title, hint }: { on: boolean; onClick: () => void; title: string; hint: string }) {
  return (
    <button type="button" onClick={onClick} className={clsx("text-left rounded-xl border p-3 flex gap-2 items-start", on ? "border-primary-container bg-[#f2f3ff]" : "border-outline-variant")}>
      <span className={clsx("w-4 h-4 rounded-full mt-0.5 flex-none", on ? "border-[5px] border-primary-container" : "border-2 border-outline")} />
      <span>
        <span className="text-sm font-bold block">{title}</span>
        <span className="text-[11px] text-outline">{hint}</span>
      </span>
    </button>
  );
}

function ReasonFields({
  value,
  onChange,
  error,
}: {
  value: { reason: CancelReason | ""; dupWh: string; note: string };
  onChange: (v: { reason: CancelReason | ""; dupWh: string; note: string }) => void;
  error: string | null;
}) {
  const r = CANCEL_REASONS.find((x) => x.value === value.reason);
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-bold">
        เหตุผลการยกเลิก <span className="text-error">*</span>
      </label>
      <select
        value={value.reason}
        onChange={(e) => onChange({ ...value, reason: e.target.value as CancelReason | "" })}
        className="input-base"
      >
        <option value="">— เลือกเหตุผล —</option>
        {CANCEL_REASONS.map((x) => (
          <option key={x.value} value={x.value}>
            {x.label}
          </option>
        ))}
      </select>
      {r && <p className="text-[11px] text-outline -mt-1">{r.hint}</p>}
      {value.reason === "duplicate" && (
        <>
          <label className="text-xs text-on-surface-variant">
            เลข WH ของใบที่ซ้ำ (ใบที่เก็บไว้) <span className="text-error">*</span>
          </label>
          <input
            value={value.dupWh}
            onChange={(e) => onChange({ ...value, dupWh: e.target.value })}
            className="input-base uppercase"
            placeholder="เช่น WH-2611-073"
          />
        </>
      )}
      {value.reason && (
        <>
          <label className="text-xs text-on-surface-variant">
            {value.reason === "other" ? (
              <>
                ระบุเหตุผล <span className="text-error">*</span>
              </>
            ) : (
              "รายละเอียดเพิ่มเติม (ไม่บังคับ)"
            )}
          </label>
          <textarea
            value={value.note}
            maxLength={CANCEL_NOTE_MAX}
            onChange={(e) => onChange({ ...value, note: e.target.value })}
            className="input-base min-h-[64px]"
            placeholder={value.reason === "other" ? "พิมพ์เหตุผลการยกเลิก..." : ""}
          />
          <p className="text-[10px] text-outline text-right -mt-1">
            {value.note.length}/{CANCEL_NOTE_MAX}
          </p>
        </>
      )}
      {error && error !== "กรุณาเลือกเหตุผล" && (
        <p className={clsx("text-[11px] font-bold", error.startsWith("กำลัง") ? "text-outline" : "text-error")}>
          {error.startsWith("กำลัง") ? "" : "✕ "}
          {error}
        </p>
      )}
      {value.reason === "duplicate" && !error && value.dupWh && (
        <p className="text-[11px] font-bold text-green-700">✓ พบใบงาน {normalizeWh(value.dupWh)}</p>
      )}
    </div>
  );
}
