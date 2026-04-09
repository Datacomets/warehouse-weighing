"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Field, SectionHeader } from "@/components/Field";
import { Icon } from "@/components/Icon";

export function HeaderForm({ doc }: { doc: any }) {
  const router = useRouter();
  const supabase = createClient();
  const readOnly = doc.status !== "in_progress";
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [f, setF] = useState({
    scale_name: doc.scale_name || "",
    qty_per_carton: doc.qty_per_carton ?? "",
    actual_count: doc.actual_count ?? "",
    width_cm: doc.width_cm ?? "",
    length_cm: doc.length_cm ?? "",
    height_cm: doc.height_cm ?? "",
    gross_weight: doc.gross_weight ?? "",
    net_weight: doc.net_weight ?? "",
    mfg_date: doc.mfg_date || "",
    exp_date: doc.exp_date || "",
    lot_number: doc.lot_number || "",
    qc_status: doc.qc_status || "no_reimburse",
    remarks: doc.remarks || "",
  });

  async function save(next?: string) {
    setSaving(true);
    setErr(null);

    if (f.mfg_date && f.exp_date && new Date(f.exp_date) < new Date(f.mfg_date)) {
      setSaving(false);
      setErr("EXP Date ต้องไม่น้อยกว่า MFG Date");
      return;
    }

    // validate ค่าลบ + ค่าที่ไม่สมเหตุสมผล
    const numFields = [
      { key: "qty_per_carton", label: "จำนวนชิ้น/ลัง" },
      { key: "actual_count", label: "จำนวนที่นับได้" },
      { key: "width_cm", label: "กว้าง" },
      { key: "length_cm", label: "ยาว" },
      { key: "height_cm", label: "สูง" },
      { key: "gross_weight", label: "Gross Weight" },
      { key: "net_weight", label: "Net Weight" },
    ] as const;
    for (const nf of numFields) {
      const v = f[nf.key];
      if (v !== "" && Number(v) < 0) {
        setSaving(false);
        setErr(`${nf.label} ต้องไม่ติดลบ`);
        return;
      }
      if (v !== "" && Number(v) > 999999) {
        setSaving(false);
        setErr(`${nf.label} มีค่ามากเกินไป`);
        return;
      }
    }

    // #21 MFG/EXP sanity
    if (f.mfg_date) {
      const y = new Date(f.mfg_date).getFullYear();
      if (y < 2000 || y > 2100) {
        setSaving(false);
        setErr("MFG Date ดูไม่สมเหตุสมผล — ตรวจสอบปีอีกครั้ง");
        return;
      }
    }
    if (f.exp_date) {
      const y = new Date(f.exp_date).getFullYear();
      if (y < 2000 || y > 2100) {
        setSaving(false);
        setErr("EXP Date ดูไม่สมเหตุสมผล — ตรวจสอบปีอีกครั้ง");
        return;
      }
    }

    const payload: any = {
      ...f,
      qty_per_carton: f.qty_per_carton === "" ? null : Number(f.qty_per_carton),
      actual_count: f.actual_count === "" ? null : Number(f.actual_count),
      width_cm: f.width_cm === "" ? null : Number(f.width_cm),
      length_cm: f.length_cm === "" ? null : Number(f.length_cm),
      height_cm: f.height_cm === "" ? null : Number(f.height_cm),
      gross_weight: f.gross_weight === "" ? null : Number(f.gross_weight),
      net_weight: f.net_weight === "" ? null : Number(f.net_weight),
      mfg_date: f.mfg_date || null,
      exp_date: f.exp_date || null,
    };

    const { error } = await supabase.from("gr_documents").update(payload).eq("id", doc.id);
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    if (next) router.push(next);
    else router.refresh();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(`/doc/${doc.id}/per-pcs`);
      }}
      className="flex flex-col gap-5"
    >
      <div className="card">
        <span className="section-title">ข้อมูลจาก Header (อ่านอย่างเดียว)</span>
        <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
          <div><b>LOT:</b> {doc.lot}</div>
          <div><b>PO:</b> {doc.po_number}</div>
          <div className="col-span-2"><b>Item:</b> {doc.item_code} — {doc.description}</div>
          <div className="col-span-2"><b>Item Supplier:</b> {doc.supplier || "-"}</div>
        </div>
      </div>

      <SectionHeader icon="balance" title="ข้อมูลการชั่ง" accent />
      <Field label="ชื่อเครื่องชั่ง">
        <input
          disabled={readOnly}
          value={f.scale_name}
          onChange={(e) => setF({ ...f, scale_name: e.target.value })}
          className="input-base"
          placeholder="เช่น WH-02"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="จำนวนชิ้น/ลัง">
          <input
            disabled={readOnly}
            type="number"
            inputMode="decimal"
            value={f.qty_per_carton}
            onChange={(e) => setF({ ...f, qty_per_carton: e.target.value })}
            className="input-base"
          />
        </Field>
        <Field label="จำนวนที่นับได้จริง (ลัง)">
          <input
            disabled={readOnly}
            type="number"
            inputMode="decimal"
            value={f.actual_count}
            onChange={(e) => setF({ ...f, actual_count: e.target.value })}
            className="input-base"
          />
        </Field>
      </div>

      <SectionHeader icon="straighten" title="ขนาดลัง (ซม.)" accent />
      <div className="grid grid-cols-3 gap-3">
        <Field label="กว้าง">
          <input
            disabled={readOnly}
            type="number"
            inputMode="decimal"
            value={f.width_cm}
            onChange={(e) => setF({ ...f, width_cm: e.target.value })}
            className="input-base"
          />
        </Field>
        <Field label="ยาว">
          <input
            disabled={readOnly}
            type="number"
            inputMode="decimal"
            value={f.length_cm}
            onChange={(e) => setF({ ...f, length_cm: e.target.value })}
            className="input-base"
          />
        </Field>
        <Field label="สูง">
          <input
            disabled={readOnly}
            type="number"
            inputMode="decimal"
            value={f.height_cm}
            onChange={(e) => setF({ ...f, height_cm: e.target.value })}
            className="input-base"
          />
        </Field>
      </div>

      <SectionHeader icon="scale" title="น้ำหนัก (kg)" accent />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Gross Weight">
          <input
            disabled={readOnly}
            type="number"
            inputMode="decimal"
            step="0.001"
            value={f.gross_weight}
            onChange={(e) => setF({ ...f, gross_weight: e.target.value })}
            className="input-base"
          />
        </Field>
        <Field label="Net Weight">
          <input
            disabled={readOnly}
            type="number"
            inputMode="decimal"
            step="0.001"
            value={f.net_weight}
            onChange={(e) => setF({ ...f, net_weight: e.target.value })}
            className="input-base"
          />
        </Field>
      </div>

      <SectionHeader icon="event" title="วันผลิต / หมดอายุ / Lot" accent />
      <div className="grid grid-cols-2 gap-3">
        <Field label="MFG">
          <input
            disabled={readOnly}
            type="date"
            value={f.mfg_date}
            onChange={(e) => setF({ ...f, mfg_date: e.target.value })}
            className="input-base"
          />
        </Field>
        <Field label="EXP">
          <input
            disabled={readOnly}
            type="date"
            value={f.exp_date}
            onChange={(e) => setF({ ...f, exp_date: e.target.value })}
            className="input-base"
          />
        </Field>
      </div>
      <Field label="Lot Number">
        <input
          disabled={readOnly}
          value={f.lot_number}
          onChange={(e) => setF({ ...f, lot_number: e.target.value })}
          className="input-base"
        />
      </Field>

      <SectionHeader icon="verified" title="QC Status" accent />
      <div className="flex gap-2">
        {[
          { v: "reimburse", label: "QC เบิก" },
          { v: "no_reimburse", label: "QC ไม่เบิก" },
        ].map((opt) => (
          <button
            type="button"
            key={opt.v}
            disabled={readOnly}
            onClick={() => setF({ ...f, qc_status: opt.v })}
            className={
              f.qc_status === opt.v
                ? "btn-primary flex-1 h-11 text-sm"
                : "btn-secondary flex-1 h-11 text-sm"
            }
          >
            {opt.label}
          </button>
        ))}
      </div>

      <Field label="หมายเหตุ">
        <textarea
          disabled={readOnly}
          rows={3}
          value={f.remarks}
          onChange={(e) => setF({ ...f, remarks: e.target.value })}
          className="input-base h-auto py-3"
        />
      </Field>

      {err && (
        <div className="bg-error-container text-on-error-container text-xs px-3 py-2 rounded-lg">
          {err}
        </div>
      )}

      {!readOnly && (
        <div className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-background via-background to-transparent px-4 py-4 z-30">
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? "กำลังบันทึก..." : "ถัดไป: ชั่ง Per Pcs"}
            <Icon name="arrow_forward" />
          </button>
        </div>
      )}
    </form>
  );
}
