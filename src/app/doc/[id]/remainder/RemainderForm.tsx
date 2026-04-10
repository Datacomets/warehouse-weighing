"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Field } from "@/components/Field";
import { Icon } from "@/components/Icon";
import { StepButtons } from "@/components/StepButtons";
import { Toast, useToast } from "@/components/Toast";

export function RemainderForm({
  doc,
  fullCartons,
}: {
  doc: any;
  fullCartons: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const readOnly = doc.status !== "in_progress";
  const [remainderPcs, setRemainderPcs] = useState<string>(
    doc.remainder_pcs != null ? String(doc.remainder_pcs) : ""
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();

  const qtyPerCarton = Number(doc.qty_per_carton) || 0;
  const remainder = Number(remainderPcs) || 0;
  const hasRemainder = remainder > 0;
  const totalPcs = qtyPerCarton * fullCartons + remainder;

  async function save() {
    setSaving(true);
    setErr(null);
    const val = remainderPcs === "" ? null : Number(remainderPcs);
    if (val !== null && val < 0) {
      setErr("จำนวนเศษต้องไม่ติดลบ");
      setSaving(false);
      return;
    }
    if (val !== null && !Number.isInteger(val)) {
      setErr("จำนวนเศษต้องเป็นจำนวนเต็ม");
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("gr_documents")
      .update({
        remainder_pcs: val,
        actual_count: fullCartons + (hasRemainder ? 1 : 0),
      })
      .eq("id", doc.id);
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    toast.show("บันทึกเศษสำเร็จ!");
    router.refresh();
  }

  return (
    <>
      <Toast message={toast.msg} />
      {/* ข้อมูลจากขั้นตอนก่อน */}
      <div className="card text-xs grid grid-cols-2 gap-2">
        <div><b>ชิ้น/ลัง (Packing List):</b> {qtyPerCarton || "-"}</div>
        <div><b>จำนวนลังเต็ม (จาก Per Carton):</b> {fullCartons}</div>
      </div>

      {/* กรอกเศษ */}
      <div className="card border-l-4 border-tertiary-fixed-dim">
        <Field label="จำนวนเศษ (ชิ้น)" hint="นับจำนวนชิ้นที่ไม่ครบลัง ถ้าไม่มีเศษให้เว้นว่าง">
          <input
            disabled={readOnly}
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={remainderPcs}
            onChange={(e) => {
              const v = e.target.value;
              if (v !== "" && Number(v) < 0) return;
              setRemainderPcs(v);
            }}
            className="input-base"
            placeholder="เช่น 45"
          />
        </Field>
        {!readOnly && (
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="btn-secondary mt-3 h-10 text-sm"
          >
            {saving ? "กำลังบันทึก..." : "บันทึกจำนวนเศษ"}
          </button>
        )}
        {err && (
          <p className="text-xs text-error mt-2">{err}</p>
        )}
      </div>

      {/* สรุป */}
      <div className="card border-l-4 border-primary-container">
        <span className="section-title">สรุปจำนวนทั้งหมด</span>
        <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
          <div className="flex flex-col items-center card bg-surface-container-low py-3">
            <Icon name="inventory_2" className="text-primary text-xl mb-1" />
            <span className="text-2xl font-headline font-bold text-primary">{fullCartons}</span>
            <span className="text-[10px] text-outline">ลังเต็ม</span>
          </div>
          <div className="flex flex-col items-center card bg-surface-container-low py-3">
            <Icon name="exposure" className="text-tertiary-fixed-dim text-xl mb-1" />
            <span className="text-2xl font-headline font-bold text-tertiary-fixed-dim">
              {hasRemainder ? `1 (${remainder} ชิ้น)` : "0"}
            </span>
            <span className="text-[10px] text-outline">ลังเศษ</span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-outline-variant/30">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold">รวมทั้งหมด</span>
            <div className="text-right">
              <span className="text-2xl font-headline font-bold text-primary">{totalPcs.toLocaleString()}</span>
              <span className="text-xs text-outline ml-1">ชิ้น</span>
            </div>
          </div>
          {qtyPerCarton > 0 && (
            <p className="text-[11px] text-outline mt-1">
              ({qtyPerCarton} x {fullCartons} ลัง) + {remainder} เศษ = {totalPcs.toLocaleString()} ชิ้น
            </p>
          )}
        </div>
      </div>

      <StepButtons
        prev={`/doc/${doc.id}/count`}
        prevLabel="ชั่งต่อลัง"
        next={`/doc/${doc.id}/issues`}
        nextLabel="รายงานปัญหา"
      />
    </>
  );
}
