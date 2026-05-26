"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Field, SectionHeader } from "@/components/Field";
import { Icon } from "@/components/Icon";
import { validateHeader } from "@/lib/validation";
import { translateSupabaseError } from "@/lib/supabaseError";
import { clsx } from "clsx";

type SaveStatus = "idle" | "saving" | "saved" | "error";

const REMARKS_MAX = 500;

export function HeaderForm({
  doc,
  userId,
  readOnly: readOnlyProp,
}: {
  doc: any;
  userId?: string;
  /** Computed by the page from canEditDocumentData(role, status). Falls
   *  back to the legacy status-only check for older callers. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const readOnly = readOnlyProp ?? doc.status !== "in_progress";
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [dirty, setDirty] = useState(false);
  const [dateErr, setDateErr] = useState<string | null>(null);

  const initial = {
    lot: doc.lot || "",
    po_number: doc.po_number || "",
    item_code: doc.item_code || "",
    description: doc.description || "",
    supplier: doc.supplier || "",
    delivery_date: doc.delivery_date || "",
    scale_name: doc.scale_name || "",
    qty_per_carton: doc.qty_per_carton ?? "",
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
  };
  const [f, setF] = useState(initial);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const initialRef = useRef(initial);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function lookupItemCode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) {
      setLookupMsg(null);
      return;
    }
    const { data, error } = await supabase
      .from("item_master")
      .select("description, product_category, obsolete")
      .eq("item_code", trimmed)
      .maybeSingle();
    if (error) {
      setLookupMsg("ค้นหา Item Code ไม่สำเร็จ");
      return;
    }
    if (data?.description) {
      setF((prev) => ({ ...prev, description: data.description }));
      setDirty(true);
      const cat = data.product_category ? ` · ${data.product_category}` : "";
      if (data.obsolete) {
        setLookupMsg(`⚠ Item นี้ถูกยกเลิก (Obsolete)${cat}`);
      } else {
        setLookupMsg(`พบใน Item Master — กรอก Description ให้แล้ว${cat}`);
      }
    } else {
      setLookupMsg("ไม่พบ Item Code นี้ใน Master — กรุณากรอก Description เอง");
    }
  }

  function update<K extends keyof typeof f>(key: K, value: (typeof f)[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function buildPayload(state: typeof f) {
    return {
      lot: state.lot,
      po_number: state.po_number,
      item_code: state.item_code,
      description: state.description,
      supplier: state.supplier,
      delivery_date: state.delivery_date || null,
      scale_name: state.scale_name,
      qty_per_carton: state.qty_per_carton === "" ? null : Number(state.qty_per_carton),
      width_cm: state.width_cm === "" ? null : Number(state.width_cm),
      length_cm: state.length_cm === "" ? null : Number(state.length_cm),
      height_cm: state.height_cm === "" ? null : Number(state.height_cm),
      gross_weight: state.gross_weight === "" ? null : Number(state.gross_weight),
      net_weight: state.net_weight === "" ? null : Number(state.net_weight),
      mfg_date: state.mfg_date || null,
      exp_date: state.exp_date || null,
      lot_number: state.lot_number,
      qc_status: state.qc_status,
      remarks: state.remarks,
    };
  }

  async function autoSave() {
    if (readOnly || !dirty) return;
    setSaveStatus("saving");
    const { error } = await supabase
      .from("gr_documents")
      .update(buildPayload(f))
      .eq("id", doc.id);
    if (error) {
      setSaveStatus("error");
      setErr(translateSupabaseError(error));
      return;
    }
    initialRef.current = f;
    setDirty(false);
    setSaveStatus("saved");
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
  }

  function validateDatesOnBlur(state: typeof f) {
    if (state.mfg_date && state.exp_date) {
      if (new Date(state.exp_date) < new Date(state.mfg_date)) {
        setDateErr("EXP Date ต้องไม่น้อยกว่า MFG Date");
        return false;
      }
    }
    setDateErr(null);
    return true;
  }

  useEffect(() => {
    if (!dirty) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  async function save(next?: string) {
    setSaving(true);
    setErr(null);

    const validationError = validateHeader(f);
    if (validationError) {
      setSaving(false);
      setErr(validationError);
      return;
    }

    const { error } = await supabase
      .from("gr_documents")
      .update(buildPayload(f))
      .eq("id", doc.id);
    setSaving(false);
    if (error) {
      setErr(translateSupabaseError(error));
      return;
    }
    if (userId) {
      await supabase.from("audit_log").insert({
        document_id: doc.id,
        actor: userId,
        action: "edit_header",
      });
    }
    initialRef.current = f;
    setDirty(false);
    if (next) router.push(next);
    else router.refresh();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(`/doc/${doc.id}/per-pcs`);
      }}
      className="flex flex-col gap-5 pb-32"
    >
      <SectionHeader icon="description" title="ข้อมูลพื้นฐาน" accent />
      <div className="grid grid-cols-2 gap-3">
        <Field label="LOT" required>
          <input
            disabled={readOnly}
            value={f.lot}
            onChange={(e) => update("lot", e.target.value)}
            onBlur={autoSave}
            className="input-base"
          />
        </Field>
        <Field label="PO Number" required>
          <input
            disabled={readOnly}
            value={f.po_number}
            onChange={(e) => update("po_number", e.target.value)}
            onBlur={autoSave}
            className="input-base"
          />
        </Field>
        <Field label="Item Code (SAP)" required className="col-span-2">
          <input
            disabled={readOnly}
            value={f.item_code}
            onChange={(e) => {
              update("item_code", e.target.value);
              setLookupMsg(null);
            }}
            onBlur={async (e) => {
              await lookupItemCode(e.target.value);
              autoSave();
            }}
            className="input-base"
            placeholder="กรอกแล้ว tab ออก เพื่อดึง Description"
          />
          {lookupMsg ? (
            <p className="text-[11px] text-outline mt-1">{lookupMsg}</p>
          ) : (
            <p className="text-[11px] text-outline mt-1">
              กรอก Item Code แล้วแตะที่อื่น เพื่อดึง Description จาก Item Master
            </p>
          )}
        </Field>
        <Field label="Description" required className="col-span-2">
          <input
            disabled={readOnly}
            value={f.description}
            onChange={(e) => update("description", e.target.value)}
            onBlur={autoSave}
            className="input-base"
          />
        </Field>
        <Field
          label="ชื่อสินค้าฝั่ง Supplier"
          hint="ชื่อที่ Supplier ใช้เรียกสินค้านี้"
          className="col-span-2"
        >
          <input
            disabled={readOnly}
            value={f.supplier}
            onChange={(e) => update("supplier", e.target.value)}
            onBlur={autoSave}
            className="input-base"
          />
        </Field>
        <Field label="Delivery Date" className="col-span-2">
          <input
            disabled={readOnly}
            type="date"
            value={f.delivery_date}
            onChange={(e) => update("delivery_date", e.target.value)}
            onBlur={autoSave}
            className="input-base"
          />
        </Field>
      </div>

      <SectionHeader icon="balance" title="ข้อมูลการชั่ง" accent />
      <Field label="ชื่อเครื่องชั่ง">
        <input
          disabled={readOnly}
          value={f.scale_name}
          onChange={(e) => update("scale_name", e.target.value)}
          onBlur={autoSave}
          className="input-base"
          placeholder="เช่น WH-02"
        />
      </Field>
      <Field label="จำนวนชิ้น/ลัง (Packing List)">
        <input
          disabled={readOnly}
          type="number"
          inputMode="decimal"
          value={f.qty_per_carton}
          onChange={(e) => update("qty_per_carton", e.target.value)}
          onBlur={autoSave}
          className="input-base"
          placeholder="เช่น 90"
        />
      </Field>

      <SectionHeader icon="straighten" title="ขนาดลัง (ซม.)" accent />
      <div className="grid grid-cols-3 gap-3">
        <Field label="กว้าง">
          <input
            disabled={readOnly}
            type="number"
            inputMode="decimal"
            value={f.width_cm}
            onChange={(e) => update("width_cm", e.target.value)}
            onBlur={autoSave}
            className="input-base"
          />
        </Field>
        <Field label="ยาว">
          <input
            disabled={readOnly}
            type="number"
            inputMode="decimal"
            value={f.length_cm}
            onChange={(e) => update("length_cm", e.target.value)}
            onBlur={autoSave}
            className="input-base"
          />
        </Field>
        <Field label="สูง">
          <input
            disabled={readOnly}
            type="number"
            inputMode="decimal"
            value={f.height_cm}
            onChange={(e) => update("height_cm", e.target.value)}
            onBlur={autoSave}
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
            onChange={(e) => update("gross_weight", e.target.value)}
            onBlur={autoSave}
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
            onChange={(e) => update("net_weight", e.target.value)}
            onBlur={autoSave}
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
            onChange={(e) => update("mfg_date", e.target.value)}
            onBlur={() => {
              if (validateDatesOnBlur(f)) autoSave();
            }}
            className={clsx("input-base", dateErr && "border-error")}
          />
        </Field>
        <Field label="EXP">
          <input
            disabled={readOnly}
            type="date"
            value={f.exp_date}
            onChange={(e) => update("exp_date", e.target.value)}
            onBlur={() => {
              if (validateDatesOnBlur(f)) autoSave();
            }}
            className={clsx("input-base", dateErr && "border-error")}
          />
        </Field>
      </div>
      {dateErr && (
        <div className="text-xs text-error -mt-3 ml-1">{dateErr}</div>
      )}
      <Field label="Lot Number">
        <input
          disabled={readOnly}
          value={f.lot_number}
          onChange={(e) => update("lot_number", e.target.value)}
          onBlur={autoSave}
          className="input-base"
        />
      </Field>

      <SectionHeader icon="verified" title="QC Status" accent />
      <div className="flex gap-2 min-w-0">
        {[
          { v: "reimburse", label: "QC เบิก" },
          { v: "no_reimburse", label: "QC ไม่เบิก" },
        ].map((opt) => (
          <button
            type="button"
            key={opt.v}
            disabled={readOnly}
            onClick={() => {
              update("qc_status", opt.v);
              setTimeout(autoSave, 0);
            }}
            className={clsx(
              "flex-1 h-11 text-sm min-w-0",
              f.qc_status === opt.v ? "btn-primary" : "btn-secondary",
              readOnly && "opacity-50 cursor-not-allowed"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <Field label="หมายเหตุ">
        <div className="relative">
          <textarea
            disabled={readOnly}
            rows={3}
            maxLength={REMARKS_MAX}
            value={f.remarks}
            onChange={(e) => update("remarks", e.target.value)}
            onBlur={autoSave}
            className="input-base h-auto py-3"
          />
          <div className="text-[10px] text-outline text-right mt-1">
            {f.remarks.length}/{REMARKS_MAX}
          </div>
        </div>
      </Field>

      {err && (
        <div className="bg-error-container text-on-error-container text-xs px-3 py-2 rounded-lg">
          {err}
        </div>
      )}

      {!readOnly && (
        <div className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-background via-background to-transparent px-4 py-4 z-30">
          <div className="flex items-center justify-between gap-3 mb-2 text-xs">
            <SaveIndicator status={saveStatus} />
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? "กำลังบันทึก..." : "ถัดไป: ชั่ง Per Pcs"}
            <Icon name="arrow_forward" />
          </button>
        </div>
      )}
    </form>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return <span className="text-outline">บันทึกอัตโนมัติเมื่อย้าย field</span>;
  if (status === "saving")
    return (
      <span className="text-outline flex items-center gap-1">
        <span className="inline-block w-3 h-3 border-2 border-outline border-t-transparent rounded-full animate-spin" />
        กำลังบันทึก...
      </span>
    );
  if (status === "saved")
    return (
      <span className="text-success flex items-center gap-1">
        <Icon name="check_circle" className="text-sm" /> บันทึกแล้ว
      </span>
    );
  return (
    <span className="text-error flex items-center gap-1">
      <Icon name="error" className="text-sm" /> บันทึกไม่สำเร็จ
    </span>
  );
}
