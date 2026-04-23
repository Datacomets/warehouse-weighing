"use client";
import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { WeightKind, WeightMeasurement } from "@/lib/types";
import { stats, fmt } from "@/lib/stats";
import { isOutlier } from "@/lib/outlier";
import { StatsCard } from "./StatsCard";
import { Icon } from "./Icon";
import { Toast, useToast } from "./Toast";
import { useConfirm } from "./ConfirmDialog";
import { clsx } from "clsx";
import { useScale } from "@/lib/useScale";

type WeightUnit = "kg" | "g" | "pcs";

const UNITS: { value: WeightUnit; label: string }[] = [
  { value: "kg", label: "Kg" },
  { value: "g", label: "g" },
  { value: "pcs", label: "ชิ้น" },
];

interface Props {
  documentId: string;
  docId: string;
  kind: WeightKind;
  initial: WeightMeasurement[];
  readOnly?: boolean;
  showPer100Toggle?: boolean;
  showQtyPerInner?: boolean;
  expectedCount?: number | null;
  initialUnit?: WeightUnit;
}

export function WeightEntry({
  documentId,
  docId,
  kind,
  initial,
  readOnly,
  showPer100Toggle,
  showQtyPerInner,
  expectedCount,
  initialUnit = "kg",
}: Props) {
  const supabase = createClient();
  const [items, setItems] = useState<WeightMeasurement[]>(initial);
  const [per100, setPer100] = useState<boolean>(initial[0]?.per_100 || false);
  const [qtyPerInner, setQtyPerInner] = useState<number | "">(initial[0]?.qty_per_inner || "");
  const [draft, setDraft] = useState<string>("");
  const [unit, setUnit] = useState<WeightUnit>(initialUnit);
  const [, startTransition] = useTransition();
  const toast = useToast();
  const { confirm, DialogElement } = useConfirm();
  const scale = useScale({
    onReading: (value) => {
      setDraft(String(value));
    },
  });

  const values = items.map((i) => Number(i.value));
  const s = stats(values);

  const unitLabel = UNITS.find((u) => u.value === unit)?.label || "kg";

  function changeUnit(newUnit: WeightUnit) {
    setUnit(newUnit);
    startTransition(async () => {
      await supabase
        .from("gr_documents")
        .update({ weight_unit: newUnit })
        .eq("id", docId);
    });
  }

  async function addValueDirect(v: number) {
    if (!Number.isFinite(v) || v <= 0) return;
    const seq = items.length + 1;
    const row: any = {
      document_id: documentId,
      kind,
      seq,
      value: v,
      per_100: showPer100Toggle ? per100 : false,
      qty_per_inner: showQtyPerInner && qtyPerInner ? Number(qtyPerInner) : null,
    };
    const { data, error } = await supabase
      .from("weight_measurements")
      .insert(row)
      .select("*")
      .single();
    if (!error && data) {
      setItems((prev) => [...prev, data as WeightMeasurement]);
      setDraft("");
    } else if (error) {
      toast.error(error.message);
    }
  }

  async function addValue() {
    const v = Number(draft);
    if (!Number.isFinite(v) || v <= 0) return;
    const seq = items.length + 1;
    const row: any = {
      document_id: documentId,
      kind,
      seq,
      value: v,
      per_100: showPer100Toggle ? per100 : false,
      qty_per_inner: showQtyPerInner && qtyPerInner ? Number(qtyPerInner) : null,
    };
    const { data, error } = await supabase
      .from("weight_measurements")
      .insert(row)
      .select("*")
      .single();
    if (!error && data) {
      setItems([...items, data as WeightMeasurement]);
      setDraft("");
    } else if (error) {
      toast.error(error.message);
    }
  }

  async function removeValue(id: string) {
    const ok = await confirm({
      title: "ลบค่านี้หรือไม่?",
      message: "ค่าที่บันทึกไว้จะถูกลบออกจากรายการ",
      confirmLabel: "ลบ",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("weight_measurements").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems(items.filter((i) => i.id !== id));
  }

  useEffect(() => {
    if (!showPer100Toggle || items.length === 0) return;
    startTransition(async () => {
      await supabase
        .from("weight_measurements")
        .update({ per_100: per100 })
        .eq("document_id", documentId)
        .eq("kind", "per_pcs");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [per100]);

  useEffect(() => {
    if (!showQtyPerInner || items.length === 0) return;
    if (qtyPerInner === "") return;
    startTransition(async () => {
      await supabase
        .from("weight_measurements")
        .update({ qty_per_inner: Number(qtyPerInner) })
        .eq("document_id", documentId)
        .eq("kind", "per_inner");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qtyPerInner]);

  return (
    <div className="flex flex-col gap-4">
      <Toast message={toast.msg} variant={toast.variant} />
      {DialogElement}
      {/* เลือกหน่วยวัด */}
      <div className="card">
        <span className="section-title">หน่วยวัด</span>
        <div className="flex gap-2 mt-2">
          {UNITS.map((u) => (
            <button
              key={u.value}
              type="button"
              disabled={readOnly}
              onClick={() => changeUnit(u.value)}
              className={clsx(
                "flex-1 h-11 text-sm font-bold rounded-xl transition-colors",
                unit === u.value ? "btn-primary" : "btn-secondary"
              )}
            >
              {u.label}
            </button>
          ))}
        </div>
      </div>

      {showPer100Toggle && (
        <div className="card">
          <span className="section-title">จำนวนที่ชั่ง</span>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              disabled={readOnly}
              onClick={() => setPer100(false)}
              className={!per100 ? "btn-primary flex-1 h-11 text-sm" : "btn-secondary flex-1 h-11 text-sm"}
            >
              Per 1 Pcs
            </button>
            <button
              type="button"
              disabled={readOnly}
              onClick={() => setPer100(true)}
              className={per100 ? "btn-primary flex-1 h-11 text-sm" : "btn-secondary flex-1 h-11 text-sm"}
            >
              Per 100 Pcs
            </button>
          </div>
        </div>
      )}

      {showQtyPerInner && (
        <div className="card">
          <label className="label-base">จำนวนชิ้น / Inner</label>
          <input
            disabled={readOnly}
            type="number"
            inputMode="numeric"
            value={qtyPerInner}
            onChange={(e) => setQtyPerInner(e.target.value === "" ? "" : Number(e.target.value))}
            className="input-base"
            placeholder="เช่น 10"
          />
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <span className="section-title">บันทึกค่าที่ชั่ง ({unitLabel})</span>
          {expectedCount && (
            <span className="text-[11px] font-bold text-on-tertiary-container">
              ชั่งแล้ว {items.length} / {expectedCount} ลัง
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {items.map((m, i) => {
            const v = Number(m.value);
            const out = isOutlier(v, s);
            return (
              <div
                key={m.id}
                className={clsx(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border",
                  out
                    ? "bg-error-container/60 border-error/40"
                    : "bg-surface-container-low border-outline-variant/30"
                )}
              >
                <span className="w-8 text-xs font-bold text-outline">#{i + 1}</span>
                <span className="flex-1 font-headline font-bold text-primary">
                  {fmt(v)} <span className="text-xs text-outline font-normal">{unitLabel}</span>
                </span>
                {out && (
                  <span className="text-error" title="ค่าผิดปกติ">
                    <Icon name="warning" className="text-base" />
                  </span>
                )}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removeValue(m.id)}
                    aria-label="ลบค่านี้"
                    className="w-11 h-11 -mr-2 flex items-center justify-center text-outline hover:text-error active:scale-95 transition-all"
                  >
                    <Icon name="delete" className="text-lg" />
                  </button>
                )}
              </div>
            );
          })}
          {items.length === 0 && (
            <p className="text-center text-xs text-outline py-4">ยังไม่มีค่าที่ชั่ง</p>
          )}
        </div>

        {!readOnly && (
          <>
            {/* เชื่อมต่อเครื่องชั่ง */}
            {scale.isSupported && unit !== "pcs" && (
              <div className="flex items-center gap-2 mt-2 mb-1">
                {scale.status === "disconnected" || scale.status === "error" ? (
                  <button
                    type="button"
                    onClick={scale.connect}
                    className="btn-secondary h-9 px-3 text-xs"
                  >
                    <Icon name="usb" className="text-base" />
                    เชื่อมต่อเครื่องชั่ง
                  </button>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-success">
                    <Icon name="check_circle" className="text-sm" />
                    เชื่อมต่อเครื่องชั่งแล้ว
                  </span>
                )}
                {scale.status === "connected" && (
                  <button
                    type="button"
                    onClick={scale.disconnect}
                    className="text-xs text-outline hover:text-error"
                  >
                    ยกเลิก
                  </button>
                )}
                {scale.error && (
                  <span className="text-xs text-error">{scale.error}</span>
                )}
              </div>
            )}

            <div className="flex gap-2 mt-2">
              <input
                type="number"
                inputMode="decimal"
                step={unit === "pcs" ? "1" : "0.001"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addValue();
                  }
                }}
                className="input-base flex-1"
                placeholder={unit === "pcs" ? "จำนวนชิ้น" : `0.000 ${unitLabel}`}
              />
              {scale.status === "connected" && unit !== "pcs" && (
                <button
                  type="button"
                  onClick={async () => {
                    const val = await scale.readOnce();
                    if (val !== null) {
                      // อ่านค่าแล้วบันทึกอัตโนมัติทันที
                      setDraft(String(val));
                      await addValueDirect(val);
                    }
                  }}
                  disabled={scale.status === ("reading" as any)}
                  className="btn-primary px-4 bg-success"
                  title="อ่านค่าจากเครื่องชั่งแล้วบันทึกทันที"
                >
                  <Icon name="scale" />
                  อ่าน+บันทึก
                </button>
              )}
              <button type="button" onClick={addValue} className="btn-primary px-4">
                <Icon name="add" />
                เพิ่ม
              </button>
            </div>
          </>
        )}
      </div>

      <StatsCard avg={s.avg} min={s.min} max={s.max} unit={unitLabel} />

      {showPer100Toggle && per100 && s.count > 0 && (
        <div className="card border-l-4 border-tertiary-fixed-dim">
          <span className="section-title">น้ำหนักต่อ 1 ชิ้น (คำนวณ)</span>
          <p className="text-xl font-headline font-bold text-primary mt-1">
            {fmt(s.avg / 100, 5)} <span className="text-xs text-outline font-normal">{unitLabel}</span>
          </p>
        </div>
      )}
    </div>
  );
}
