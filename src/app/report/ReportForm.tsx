"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import {
  BASIS_LABEL,
  COLUMNS,
  GROUP_LABEL,
  ISSUE_OPTS,
  PHOTO_MODE_LABEL,
  PHOTO_SLOTS,
  PRESETS,
  QC_OPTS,
  QUICK_RANGES,
  STATUS_OPTS,
  UNIT_OPTS,
  photoChoiceText,
  toQuery,
  type Basis,
  type PhotoMode,
  type ReportFilters,
} from "@/lib/report";
import type { PhotoCounts } from "@/lib/reportPhotos";
import { ExportButtons, type ExportInfo } from "./ExportPanel";

export interface ReportOptions {
  categories: { v: string; n: number }[];
  suppliers: string[];
  operators: { id: string; name: string; n: number }[];
}

const SAVED_KEY = "comets-gr-report-templates";
type Saved = { name: string; q: string };
type PopKey = "preset" | "date" | "status" | "more" | "cols" | "photo";

function readSaved(): Saved[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
  } catch {
    return [];
  }
}
const thDate = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;

/** Button that opens a panel under it. Closes on outside click / Esc (= discard). */
function Drop({
  id,
  open,
  setOpen,
  label,
  value,
  badge,
  ghost,
  align = "left",
  width = 360,
  className = "",
  children,
}: {
  id: PopKey;
  open: PopKey | null;
  setOpen: (k: PopKey | null) => void;
  label: string;
  value?: string;
  badge?: number;
  ghost?: boolean;
  align?: "left" | "right";
  width?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isOpen = open === id;
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, setOpen]);
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setOpen(isOpen ? null : id)}
        className={`h-10 w-full sm:w-auto inline-flex items-center gap-1.5 pl-3 pr-2 rounded-xl border whitespace-nowrap transition ${
          isOpen ? "border-primary-container ring-[3px] ring-primary-fixed bg-white" : ghost ? "border-transparent bg-surface-container-low hover:bg-surface-container" : "border-outline-variant bg-white hover:border-outline"
        }`}
      >
        <span className="text-[11px] text-outline">{label}</span>
        {value && <span className="text-[13px] font-semibold text-primary max-w-[220px] truncate mr-auto sm:mr-0">{value}</span>}
        {!!badge && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-primary-container text-white text-[10px] font-bold inline-flex items-center justify-center">{badge}</span>}
        <Icon name="expand_more" className="text-lg text-outline" />
      </button>
      {isOpen && (
        <div
          role="dialog"
          aria-label={label}
          style={{ width }}
          className={`absolute top-[calc(100%+6px)] z-40 max-w-[calc(100vw-32px)] bg-white rounded-2xl border border-outline-variant/40 shadow-[0_18px_44px_rgba(0,0,40,0.2)] p-4 ${align === "right" ? "right-0" : "left-0"} max-sm:fixed max-sm:inset-x-3 max-sm:bottom-3 max-sm:top-auto max-sm:!w-auto max-sm:max-w-none max-sm:max-h-[78vh] max-sm:overflow-y-auto max-sm:z-[70]`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function PopFoot({ onClear, clearLabel = "ล้าง", onApply, applyLabel = "ใช้", disabled }: { onClear?: () => void; clearLabel?: string; onApply: () => void; applyLabel?: string; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between border-t border-outline-variant/30 mt-3 pt-3">
      {onClear ? (
        <button type="button" onClick={onClear} className="text-xs font-bold text-primary-container">
          {clearLabel}
        </button>
      ) : (
        <span />
      )}
      <button type="button" disabled={disabled} onClick={onApply} className="btn-primary h-9 px-4 text-xs disabled:opacity-50">
        {applyLabel}
      </button>
    </div>
  );
}

function Sel({ label, value, onChange, children, full }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
      <span className="text-[11px] text-outline font-bold">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input-base h-10 text-sm mt-0.5 py-0">
        {children}
      </select>
    </label>
  );
}

export function ReportForm({
  initial,
  options,
  canSeeCancelled,
  counts,
  summary,
  info,
}: {
  initial: ReportFilters;
  options: ReportOptions;
  canSeeCancelled: boolean;
  counts: PhotoCounts;
  summary: { docs: number; cartons: number; pcs: number; issueDocs: number };
  info: ExportInfo;
}) {
  const router = useRouter();
  const [open, setOpenRaw] = useState<PopKey | null>(null);
  const [d, setD] = useState<ReportFilters>(initial); // draft edited inside the open panel
  const [saved, setSaved] = useState<Saved[]>([]);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState(initial.codes.join(", "));
  const [colSearch, setColSearch] = useState("");
  useEffect(() => {
    setD(initial);
    setCodes(initial.codes.join(", "));
    setBusy(false);
  }, [initial]);
  useEffect(() => setSaved(readSaved()), []);

  /** opening a panel starts a fresh draft from what is applied */
  const setOpen = (k: PopKey | null) => {
    if (k) {
      setD(initial);
      setColSearch("");
    }
    setOpenRaw(k);
  };
  const set = <K extends keyof ReportFilters>(k: K, v: ReportFilters[K]) => setD((x) => ({ ...x, [k]: v }));
  const toggle = (k: "status" | "cols", v: string) => setD((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((s) => s !== v) : [...x[k], v] }));

  function apply(next: ReportFilters, keepScroll = true) {
    setOpenRaw(null);
    setBusy(true);
    router.push(`/report?${toQuery({ ...next, cols: COLUMNS.filter((c) => next.cols.includes(c.key)).map((c) => c.key) })}`, { scroll: !keepScroll });
  }
  function pickPreset(key: string) {
    const p = PRESETS.find((x) => x.key === key)!;
    apply({ ...initial, preset: key, cols: p.cols, status: p.set?.status ?? [], issue: p.set?.issue ?? "", abnormal: p.set?.abnormal ?? false });
  }
  function applyCodes() {
    const list = codes.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (list.join(",") !== initial.codes.join(",")) apply({ ...initial, codes: list });
  }
  function saveTemplate() {
    const name = prompt("ตั้งชื่อรูปแบบนี้ (เช่น สรุปลูกค้า A ประจำสัปดาห์)");
    if (!name?.trim()) return;
    const list = [{ name: name.trim(), q: toQuery(initial) }, ...readSaved().filter((s) => s.name !== name.trim())].slice(0, 12);
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(list));
    } catch {}
    setSaved(list);
  }
  function delTemplate(name: string) {
    const list = readSaved().filter((s) => s.name !== name);
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(list));
    } catch {}
    setSaved(list);
  }

  const statusOpts = STATUS_OPTS.filter((s) => s.v !== "cancelled" || canSeeCancelled);
  const range = QUICK_RANGES().find((r) => r.from === initial.from && r.to === initial.to);
  const preset = PRESETS.find((p) => p.key === initial.preset);
  const statusText = initial.status.length === 0 ? "ทั้งหมด" : initial.status.length === 1 ? STATUS_OPTS.find((s) => s.v === initial.status[0])?.label : `${initial.status.length} สถานะ`;
  const moreCount = [initial.category, initial.operator, initial.supplier, initial.issue, initial.qc, initial.unit].filter(Boolean).length + (initial.abnormal ? 1 : 0) + (initial.basis !== "created_at" ? 1 : 0);
  const optLabel = (list: { v: string; label: string }[], v: string) => list.find((o) => o.v === v)?.label || v;

  // "ใช้อยู่" chips — every active condition, removable where it makes sense
  const chips: { label: string; clear?: Partial<ReportFilters> }[] = [{ label: `${thDate(initial.from)} – ${thDate(initial.to)}` }];
  if (initial.basis !== "created_at") chips.push({ label: `นับจาก ${BASIS_LABEL[initial.basis]}`, clear: { basis: "created_at" } });
  if (initial.status.length) chips.push({ label: `สถานะ: ${statusText}`, clear: { status: [] } });
  if (initial.codes.length) chips.push({ label: `Item Code: ${initial.codes.join(", ")}`, clear: { codes: [] } });
  if (initial.category) chips.push({ label: `หมวด: ${initial.category}`, clear: { category: "" } });
  if (initial.operator) chips.push({ label: `ผู้ชั่ง: ${options.operators.find((o) => o.id === initial.operator)?.name || "-"}`, clear: { operator: "" } });
  if (initial.supplier) chips.push({ label: `ชื่อสินค้าฝั่ง Supplier: ${initial.supplier}`, clear: { supplier: "" } });
  if (initial.issue) chips.push({ label: `ปัญหา: ${optLabel(ISSUE_OPTS, initial.issue)}`, clear: { issue: "" } });
  if (initial.qc) chips.push({ label: `QC: ${optLabel(QC_OPTS, initial.qc)}`, clear: { qc: "" } });
  if (initial.unit) chips.push({ label: `หน่วย: ${optLabel(UNIT_OPTS, initial.unit)}`, clear: { unit: "" } });
  if (initial.abnormal) chips.push({ label: "น้ำหนักผิดปกติ", clear: { abnormal: false } });
  const clearAll: Partial<ReportFilters> = { basis: "created_at", status: [], codes: [], category: "", operator: "", supplier: "", issue: "", qc: "", unit: "", abnormal: false };

  const visibleCols = useMemo(() => {
    const q = colSearch.trim().toLowerCase();
    return q ? COLUMNS.filter((c) => c.label.toLowerCase().includes(q)) : COLUMNS;
  }, [colSearch]);

  return (
    <div className="flex flex-col gap-3">
      {/* ---- row 1: what data ---- */}
      <div className={`card py-2.5 px-3 transition ${busy ? "opacity-70" : ""}`}>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Drop id="preset" className="col-span-2 sm:col-span-1" open={open} setOpen={setOpen} label="รูปแบบ" value={preset?.label} width={300}>
            <div className="text-[13px] font-bold text-primary mb-2">รูปแบบสำเร็จรูป</div>
            <div className="flex flex-col">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => pickPreset(p.key)}
                  className={`text-left text-[13px] rounded-lg px-2.5 py-2 ${initial.preset === p.key ? "bg-primary-fixed text-primary-container font-bold" : "hover:bg-surface-container-low"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {saved.length > 0 && (
              <>
                <div className="text-[11px] font-bold text-outline mt-3 mb-1">รูปแบบของฉัน (เก็บในเครื่องนี้)</div>
                {saved.map((s) => (
                  <div key={s.name} className="flex items-center rounded-lg hover:bg-surface-container-low">
                    <a href={`/report?${s.q}`} className="flex-1 text-[13px] px-2.5 py-2 inline-flex items-center gap-1.5">
                      <Icon name="bookmark" className="text-base text-[#9a5c00]" /> {s.name}
                    </a>
                    <button type="button" onClick={() => delTemplate(s.name)} className="px-2 text-outline" aria-label={`ลบ ${s.name}`}>
                      <Icon name="close" className="text-base" />
                    </button>
                  </div>
                ))}
              </>
            )}
          </Drop>

          <Drop id="date" open={open} setOpen={setOpen} label="ช่วงวันที่" value={range?.label || `${thDate(initial.from)} – ${thDate(initial.to)}`} width={400}>
            <div className="text-[13px] font-bold text-primary mb-2">ช่วงวันที่</div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {QUICK_RANGES().map((r) => (
                <button
                  type="button"
                  key={r.label}
                  onClick={() => setD((x) => ({ ...x, from: r.from, to: r.to }))}
                  className={`text-xs rounded-full px-3 py-1 border ${d.from === r.from && d.to === r.to ? "bg-primary-fixed border-primary-container text-primary-container font-bold" : "border-outline-variant"}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="text-[11px] text-outline font-bold">ตั้งแต่</span>
                <input type="date" value={d.from} onChange={(e) => set("from", e.target.value)} className="input-base h-10 text-sm mt-0.5" />
              </label>
              <label>
                <span className="text-[11px] text-outline font-bold">ถึง</span>
                <input type="date" value={d.to} onChange={(e) => set("to", e.target.value)} className="input-base h-10 text-sm mt-0.5" />
              </label>
            </div>
            <PopFoot onClear={() => setOpen(null)} clearLabel="ยกเลิก" onApply={() => apply(d)} applyLabel="ใช้ช่วงนี้" disabled={!d.from || !d.to || d.from > d.to} />
          </Drop>

          <Drop id="status" open={open} setOpen={setOpen} label="สถานะ" value={statusText} width={280}>
            <div className="text-[13px] font-bold text-primary mb-1">สถานะ</div>
            <p className="text-[11px] text-outline mb-2">ไม่ติ๊ก = ทั้งหมด (ไม่รวมใบที่ยกเลิก)</p>
            <div className="flex flex-col gap-1.5">
              {statusOpts.map((s) => (
                <label key={s.v} className="inline-flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={d.status.includes(s.v)} onChange={() => toggle("status", s.v)} className="accent-[#000080] w-4 h-4" />
                  {s.label}
                </label>
              ))}
            </div>
            <PopFoot onClear={() => set("status", [])} onApply={() => apply(d)} />
          </Drop>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              applyCodes();
            }}
            className="col-span-2 sm:flex-1 sm:min-w-[200px] relative"
          >
            <button type="submit" aria-label="กรองตาม Item Code" className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-outline hover:text-primary">
              <Icon name="search" className="text-lg" />
            </button>
            <input value={codes} onChange={(e) => setCodes(e.target.value)} placeholder="Item Code (คั่นด้วย , ) แล้วกด Enter" className="input-base h-10 text-sm pl-10" />
          </form>

          <Drop id="more" className="col-span-2 sm:col-span-1" open={open} setOpen={setOpen} label="ตัวกรองเพิ่มเติม" badge={moreCount} ghost align="right" width={520}>
            <div className="text-[13px] font-bold text-primary mb-2">ตัวกรองเพิ่มเติม</div>
            <div className="grid grid-cols-2 gap-2.5">
              <Sel label={`หมวดสินค้า (${options.categories.length})`} value={d.category} onChange={(v) => set("category", v)}>
                <option value="">ทุกหมวด</option>
                {options.categories.map((c) => (
                  <option key={c.v} value={c.v}>
                    {c.v} ({c.n} ใบ)
                  </option>
                ))}
              </Sel>
              <Sel label={`ผู้ชั่ง (${options.operators.length})`} value={d.operator} onChange={(v) => set("operator", v)}>
                <option value="">ทุกคน</option>
                {options.operators.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.n} ใบ)
                  </option>
                ))}
              </Sel>
              <label className="block col-span-2">
                <span className="text-[11px] text-outline font-bold">ชื่อสินค้าฝั่ง Supplier ({options.suppliers.length})</span>
                <input list="sup-list" value={d.supplier} onChange={(e) => set("supplier", e.target.value)} placeholder="ทั้งหมด — พิมพ์เพื่อค้นหา" className="input-base h-10 text-sm mt-0.5" />
                <datalist id="sup-list">
                  {options.suppliers.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </label>
              <Sel label="ปัญหาที่รายงาน" value={d.issue} onChange={(v) => set("issue", v)}>
                {ISSUE_OPTS.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.label}
                  </option>
                ))}
              </Sel>
              <Sel label="สถานะ QC" value={d.qc} onChange={(v) => set("qc", v)}>
                {QC_OPTS.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.label}
                  </option>
                ))}
              </Sel>
              <Sel label="หน่วยวัด" value={d.unit} onChange={(v) => set("unit", v)}>
                {UNIT_OPTS.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.label}
                  </option>
                ))}
              </Sel>
              <Sel label="นับวันที่จาก" value={d.basis} onChange={(v) => set("basis", v as Basis)}>
                {Object.entries(BASIS_LABEL).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </Sel>
            </div>
            <label className="flex items-center gap-2 text-[13px] mt-3">
              <input type="checkbox" checked={d.abnormal} onChange={(e) => set("abnormal", e.target.checked)} className="accent-[#000080] w-4 h-4" />
              เฉพาะน้ำหนักผิดปกติ (ต่างจากค่าเฉลี่ยเกิน 10%)
            </label>
            <PopFoot
              onClear={() => setD((x) => ({ ...x, category: "", operator: "", supplier: "", issue: "", qc: "", unit: "", basis: "created_at", abnormal: false }))}
              onApply={() => apply(d)}
              applyLabel="ใช้ตัวกรอง"
            />
          </Drop>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <span className="text-[11px] font-bold text-outline mr-0.5">ใช้อยู่:</span>
          {chips.map((c) => (
            <span key={c.label} className="inline-flex items-center gap-0.5 bg-primary-fixed text-primary-container text-xs font-semibold rounded-full pl-2.5 pr-1.5 py-0.5">
              {c.label}
              {c.clear && (
                <button type="button" onClick={() => apply({ ...initial, ...c.clear })} className="w-5 h-5 rounded-full hover:bg-white/70 inline-flex items-center justify-center" aria-label={`เอา ${c.label} ออก`}>
                  <Icon name="close" className="text-sm" />
                </button>
              )}
            </span>
          ))}
          {chips.length > 1 && (
            <button type="button" onClick={() => apply({ ...initial, ...clearAll })} className="text-xs font-bold text-primary-container ml-1">
              ล้างตัวกรอง
            </button>
          )}
          {busy && <span className="text-[11px] text-outline ml-auto">กำลังดึงข้อมูล...</span>}
        </div>
      </div>

      {/* ---- row 2: summary + what the file looks like ---- */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          {[
            [summary.docs, "ใบงาน"],
            [summary.cartons, "ลังเต็ม"],
            [summary.pcs, "ชิ้นรวม"],
            [summary.issueDocs, "ใบที่มีปัญหา"],
          ].map(([v, l]) => (
            <span key={l} className="inline-flex items-baseline gap-1.5">
              <b className="font-headline text-xl text-primary">{Number(v).toLocaleString()}</b>
              <span className="text-xs text-outline">{l}</span>
            </span>
          ))}
        </div>
        <div className="w-full sm:w-auto sm:ml-auto grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Drop id="cols" open={open} setOpen={setOpen} label="คอลัมน์" value={`${initial.cols.length} จาก ${COLUMNS.length}`} ghost align="right" width={600}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[13px] font-bold text-primary">คอลัมน์</span>
              <span className="text-xs text-outline">
                {d.cols.length} จาก {COLUMNS.length}
              </span>
              <label className="ml-auto relative w-48">
                <Icon name="search" className="absolute left-2 top-1/2 -translate-y-1/2 text-base text-outline" />
                <input value={colSearch} onChange={(e) => setColSearch(e.target.value)} placeholder="ค้นหาคอลัมน์" className="input-base h-8 text-xs pl-8" />
              </label>
            </div>
            <div className="max-h-[52vh] overflow-y-auto pr-1">
              {(Object.keys(GROUP_LABEL) as (keyof typeof GROUP_LABEL)[]).map((g) => {
                const cs = visibleCols.filter((c) => c.group === g);
                if (!cs.length) return null;
                const all = cs.every((c) => d.cols.includes(c.key));
                return (
                  <div key={g} className="mb-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-outline font-extrabold">{GROUP_LABEL[g]}</span>
                      <button
                        type="button"
                        className="text-[11px] text-primary-container font-bold"
                        onClick={() => setD((x) => ({ ...x, cols: all ? x.cols.filter((k) => !cs.some((c) => c.key === k)) : Array.from(new Set([...x.cols, ...cs.map((c) => c.key)])) }))}
                      >
                        {all ? "ไม่เลือกทั้งกลุ่ม" : "เลือกทั้งกลุ่ม"}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 mt-1">
                      {cs.map((c) => (
                        <label key={c.key} className="inline-flex items-center gap-2 text-[13px]">
                          <input type="checkbox" checked={d.cols.includes(c.key)} onChange={() => toggle("cols", c.key)} className="accent-[#000080] w-4 h-4" />
                          {c.label}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <PopFoot
              onClear={() => set("cols", PRESETS.find((p) => p.key === initial.preset)?.cols || [])}
              clearLabel="กลับค่าเริ่มต้นของรูปแบบนี้"
              onApply={() => apply(d)}
              applyLabel={`ใช้ ${d.cols.length} คอลัมน์`}
              disabled={d.cols.length === 0}
            />
          </Drop>

          <Drop
            id="photo"
            open={open}
            setOpen={setOpen}
            label="รูปในไฟล์"
            value={[initial.pphoto === "none" ? "" : photoChoiceText(initial), initial.iphoto ? "ปัญหา" : ""].filter(Boolean).join(" · ") || "ไม่ใส่"}
            ghost
            align="right"
            width={340}
          >
            <div className="text-[13px] font-bold text-primary mb-2">รูปในไฟล์ Export</div>
            <div className="text-[11px] text-outline font-bold mb-1">รูปสินค้า</div>
            <div className="grid grid-cols-2 bg-surface-container-low rounded-xl p-0.5 gap-0.5" role="radiogroup" aria-label="รูปสินค้าในไฟล์">
              {(["none", "primary"] as PhotoMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={initial.pphoto === m}
                  onClick={() => apply({ ...initial, pphoto: m })}
                  className={`text-xs rounded-lg px-1.5 py-1.5 leading-tight ${initial.pphoto === m ? "bg-white text-primary font-bold shadow-sm" : "text-outline"}`}
                >
                  {PHOTO_MODE_LABEL[m]}
                </button>
              ))}
            </div>
            {initial.pphoto === "primary" && (
              <div className="mt-3">
                <div className="text-[11px] text-outline font-bold mb-1.5">รูปที่จะใส่ (ตามลำดับในหน้าใบงาน)</div>
                <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="เลือกรูปลำดับที่">
                  {PHOTO_SLOTS.map((n) => {
                    const on = initial.pslots.includes(n);
                    const next = on ? initial.pslots.filter((x) => x !== n) : [...initial.pslots, n].sort((a, b) => a - b);
                    return (
                      <label
                        key={n}
                        className={`h-10 rounded-xl border inline-flex items-center justify-center gap-1.5 text-[13px] cursor-pointer select-none transition ${
                          on ? "border-primary-container bg-primary-fixed text-primary-container font-bold" : "border-outline-variant text-outline hover:border-outline"
                        } ${on && initial.pslots.length === 1 ? "cursor-not-allowed" : ""}`}
                        title={on && initial.pslots.length === 1 ? "ต้องเลือกอย่างน้อย 1 รูป (หรือเลือก ไม่ใส่)" : undefined}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={on && initial.pslots.length === 1}
                          onChange={() => apply({ ...initial, pslots: next })}
                          className="accent-[#000080] w-4 h-4"
                        />
                        {n}
                        {n === 1 && <span aria-label="รูปหลัก">★</span>}
                      </label>
                    );
                  })}
                </div>
                <p className="text-[11px] text-outline mt-1.5">รูป 1 = รูปหลัก ★ · ใบงานที่ไม่มีรูปลำดับนั้นจะเว้นว่าง</p>
              </div>
            )}
            <label className="flex items-start gap-2 text-[13px] mt-3">
              <input type="checkbox" checked={initial.iphoto} onChange={(e) => apply({ ...initial, iphoto: e.target.checked })} className="accent-[#000080] w-4 h-4 mt-0.5" />
              <span>
                ใส่รายละเอียดและรูปปัญหา
                <span className="block text-[11px] text-outline">{counts.issueCount ? `${counts.issuePics.toLocaleString()} รูป จาก ${counts.issueCount.toLocaleString()} ปัญหา` : "ไม่มีปัญหาที่รายงานในช่วงนี้"}</span>
              </span>
            </label>
            <div className="mt-3 rounded-xl bg-[#fff4e2] text-[#5c3800] text-xs px-3 py-2 flex items-center gap-1.5">
              <Icon name="photo_library" className="text-sm" />
              <span>
                รูปสินค้า <b>{counts.prodPics.toLocaleString()}</b> · รูปปัญหา <b>{counts.issuePics.toLocaleString()}</b>
              </span>
            </div>
          </Drop>

          <span className="w-px h-6 bg-outline-variant/50 mx-0.5 hidden sm:block" />
          <div className="col-span-2 flex gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
          <ExportButtons e={info} />
          <button type="button" onClick={saveTemplate} title="บันทึกเป็นรูปแบบของฉัน" aria-label="บันทึกเป็นรูปแบบของฉัน" className="!flex-none w-10 h-10 rounded-xl bg-surface-container-low text-primary inline-flex items-center justify-center hover:bg-surface-container">
            <Icon name="bookmark_add" className="text-lg" />
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
