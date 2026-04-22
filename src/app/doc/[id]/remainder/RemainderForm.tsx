"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Field } from "@/components/Field";
import { Icon } from "@/components/Icon";
import { validateRemainder } from "@/lib/validation";
import { translateSupabaseError } from "@/lib/supabaseError";
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

  async function persistRemainder(val: number | null, successMsg: string) {
    setSaving(true);
    setErr(null);
    const { error } = await supabase
      .from("gr_documents")
      .update({
        remainder_pcs: val,
        actual_count: fullCartons + ((val ?? 0) > 0 ? 1 : 0),
      })
      .eq("id", doc.id);
    setSaving(false);
    if (error) {
      setErr(translateSupabaseError(error));
      return;
    }
    toast.show(successMsg);
    router.refresh();
  }

  async function save() {
    const validationError = validateRemainder(remainderPcs);
    if (validationError) {
      setErr(validationError);
      return;
    }
    const val = remainderPcs === "" ? null : Number(remainderPcs);
    await persistRemainder(val, "บันทึกเศษสำเร็จ!");
  }

  async function markNoRemainder() {
    setRemainderPcs("0");
    await persistRemainder(0, "บันทึกว่าไม่มีเศษ");
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
        <Field label="จำนวนเศษ (ชิ้น)" hint="นับจำนวนชิ้นที่ไม่ครบลัง ถ้าไม่มีเศษให้กดปุ่ม 'ไม่มีเศษ'">
          <input
            disabled={readOnly}
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={remainderPcs}
            onChange={(e) => {
              const v = e.target.value;
              if (v !== "" && (Number(v) < 0 || !Number.isInteger(Number(v)))) return;
              setRemainderPcs(v);
            }}
            className="input-base"
            placeholder="เช่น 45"
          />
        </Field>
        {!readOnly && (
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="btn-primary flex-1 h-10 text-sm"
            >
              {saving ? "กำลังบันทึก..." : "บันทึกจำนวนเศษ"}
            </button>
            <button
              type="button"
              onClick={markNoRemainder}
              disabled={saving}
              className="btn-secondary h-10 px-4 text-sm whitespace-nowrap"
              title="กดเพื่อบันทึกว่าไม่มีเศษ (0 ชิ้น)"
            >
              <Icon name="block" className="text-base" />
              ไม่มีเศษ
            </button>
          </div>
        )}
        {doc.remainder_pcs === 0 && (
          <p className="text-[11px] text-success mt-2 flex items-center gap-1">
            <Icon name="check_circle" className="text-sm" />
            บันทึกแล้วว่าไม่มีเศษ
          </p>
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
